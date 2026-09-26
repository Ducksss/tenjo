/// Tenjo: a pity-weighted ticket ballot run as an escrow vault. Each entrant locks a
/// refundable deposit of `Coin<T>`, the draw commits a seed from Sui randomness, and one
/// settlement transaction pays the organiser for the winners' seats, refunds every loser,
/// mints each winner a soulbound Ticket and updates the series' loss ledger.
///
/// Chances = 1 + min(5, losses in the series since the last win). Winners reset to 0 and
/// losers gain 1. A series has at most one unsettled drop, so a ledger value cannot change
/// between an entry and its settlement.
module tenjo::ballot;

use std::string::String;
use sui::balance::{Self, Balance};
use sui::bcs;
use sui::clock::Clock;
use sui::coin::{Self, Coin};
use sui::display;
use sui::ed25519;
use sui::event;
use sui::hash;
use sui::package;
use sui::random::{Self, Random};
use sui::table::{Self, Table};

// === Limits ===

/// Most entrants one drop accepts.
const MAX_ENTRANTS: u64 = 300;
/// Most items one drop allocates.
const MAX_ITEMS: u64 = 300;
/// Most extra chances a loss streak earns (so at most 6 chances).
const MAX_EXTRA: u64 = 5;
/// Anonymous codes are 16 bytes (32 hex characters off-chain).
const CODE_LENGTH: u64 = 16;
/// Registrar keys are raw 32-byte Ed25519 public keys.
const KEY_LENGTH: u64 = 32;
/// Bytes of randomness committed by `draw`.
const SEED_LENGTH: u16 = 32;
/// Domain tag at the start of every entry permit.
const PERMIT_TAG: vector<u8> = b"tenjo:enter:v1";

// === Abort codes ===

/// `items` must be between 1 and 300.
#[error(code = 0)]
const EInvalidItems: vector<u8> = b"Items must be between 1 and 300.";
/// A drop must close in the future.
#[error(code = 1)]
const EClosesInPast: vector<u8> = b"The closing time must be in the future.";
/// The series already has an unsettled drop.
#[error(code = 2)]
const ESeriesBusy: vector<u8> = b"Settle the current drop in this series first.";
/// The series passed does not own this drop.
#[error(code = 3)]
const EWrongSeries: vector<u8> = b"This drop belongs to another series.";
/// Entries are accepted strictly before `closes_at_ms`.
#[error(code = 4)]
const EEntryClosed: vector<u8> = b"Entries are closed for this drop.";
/// One entry per anonymous code per drop.
#[error(code = 5)]
const EAlreadyEntered: vector<u8> = b"This code already entered the drop.";
/// The drop already has 300 entrants.
#[error(code = 6)]
const EDropFull: vector<u8> = b"This drop has reached 300 entrants.";
/// Codes must be exactly 16 bytes.
#[error(code = 7)]
const EInvalidCode: vector<u8> = b"Anonymous codes are 16 bytes.";
/// `register` only admits free drops; paid entries go through `enter`.
#[error(code = 8)]
const EPaidDrop: vector<u8> = b"Paid drops need a fan-signed entry with a deposit.";
/// The deposit must equal the drop's price exactly.
#[error(code = 9)]
const EWrongDeposit: vector<u8> = b"The deposit must equal the entry price.";
/// The permit was not signed by the series registrar for this drop, code and sender.
#[error(code = 10)]
const EBadPermit: vector<u8> = b"The entry permit is not valid for this sender.";
/// The draw opens at `closes_at_ms`.
#[error(code = 11)]
const ETooEarly: vector<u8> = b"Draw not open yet. Wait until entries close.";
/// A drop draws exactly once.
#[error(code = 12)]
const EAlreadyDrawn: vector<u8> = b"This drop was already drawn.";
/// Settlement needs the committed seed.
#[error(code = 13)]
const ENotDrawn: vector<u8> = b"Draw the drop before settling it.";
/// A drop settles exactly once.
#[error(code = 14)]
const EAlreadySettled: vector<u8> = b"This drop was already settled.";
/// Registrar keys must be 32 bytes.
#[error(code = 15)]
const EInvalidRegistrar: vector<u8> = b"The registrar must be a 32-byte Ed25519 public key.";

// === Objects ===

/// One-time witness: claims the Publisher that owns the Ticket display.
public struct BALLOT has drop {}

/// Authority to create series and drops and to register free entries.
public struct OrganiserCap has key, store { id: UID }

/// A tour, shop or product line whose drops share one loss ledger.
public struct Series has key {
    id: UID,
    name: String,
    /// Ed25519 public key whose permits admit fan-signed entries.
    registrar: vector<u8>,
    /// Losses since the last win, keyed by 16-byte anonymous code. Absent means 0.
    losses: Table<vector<u8>, u64>,
    /// The unsettled drop, if any.
    active_drop: Option<ID>,
}

/// One entrant. `chances` is captured from the ledger at entry.
public struct Entry has copy, drop, store {
    code: vector<u8>,
    chances: u64,
    payer: address,
    paid: u64,
}

/// One allocation event: an escrow vault that settles in a single transaction.
public struct Drop<phantom T> has key {
    id: UID,
    series: ID,
    title: String,
    items: u64,
    /// Deposit per entry in the smallest unit of `T`; 0 for a free drop.
    price: u64,
    closes_at_ms: u64,
    /// Receives the winners' deposits.
    payout: address,
    entries: vector<Entry>,
    entered: Table<vector<u8>, bool>,
    escrow: Balance<T>,
    seed: Option<vector<u8>>,
    /// Winning codes in pick order.
    winners: vector<vector<u8>>,
    settled: bool,
}

/// Proof of a win. `key` without `store`: it cannot be transferred.
public struct Ticket has key {
    id: UID,
    drop: ID,
    code: vector<u8>,
    title: String,
    /// 1-based pick order.
    pick: u64,
}

// === Events ===

public struct SeriesCreated has copy, drop {
    series: ID,
    name: String,
    registrar: vector<u8>,
}

public struct DropCreated has copy, drop {
    drop: ID,
    series: ID,
    title: String,
    items: u64,
    price: u64,
    closes_at_ms: u64,
    payout: address,
}

public struct Entered has copy, drop {
    drop: ID,
    code: vector<u8>,
    /// Ledger value read at entry.
    losses: u64,
    chances: u64,
    payer: address,
    paid: u64,
    /// 0-based position in entry order.
    position: u64,
}

public struct Drawn has copy, drop {
    drop: ID,
    seed: vector<u8>,
    entrants: u64,
    total_chances: u64,
}

/// One entry's settlement, in entry order.
public struct Outcome has copy, drop, store {
    code: vector<u8>,
    chances: u64,
    losses_before: u64,
    losses_after: u64,
    /// 1-based pick order, or 0 for a loss.
    pick: u64,
    refunded: u64,
}

public struct Settled has copy, drop {
    drop: ID,
    series: ID,
    seed: vector<u8>,
    /// Winning codes in pick order, with each pick's roll and the pool it was drawn from.
    winners: vector<vector<u8>>,
    rolls: vector<u64>,
    pools: vector<u64>,
    outcomes: vector<Outcome>,
    unallocated: u64,
    total_refunded: u64,
    total_paid_out: u64,
    payout: address,
}

// === Setup ===

fun init(otw: BALLOT, ctx: &mut TxContext) {
    let publisher = package::claim(otw, ctx);
    let mut ticket_display = display::new<Ticket>(&publisher, ctx);
    ticket_display.add(b"name".to_string(), b"Tenj\xC5\x8D ticket: {title}".to_string());
    ticket_display.add(
        b"description".to_string(),
        b"Won in a Tenj\xC5\x8D pity-weighted ballot. Non-transferable.".to_string(),
    );
    ticket_display.add(b"project_url".to_string(), b"https://tenjo-azure.vercel.app".to_string());
    ticket_display.update_version();
    transfer::public_transfer(ticket_display, ctx.sender());
    transfer::public_transfer(publisher, ctx.sender());
    transfer::public_transfer(OrganiserCap { id: object::new(ctx) }, ctx.sender());
}

public fun create_series(
    _: &OrganiserCap,
    name: String,
    registrar: vector<u8>,
    ctx: &mut TxContext,
): ID {
    assert!(registrar.length() == KEY_LENGTH, EInvalidRegistrar);
    let series = Series {
        id: object::new(ctx),
        name,
        registrar,
        losses: table::new(ctx),
        active_drop: option::none(),
    };
    let id = object::id(&series);
    event::emit(SeriesCreated { series: id, name, registrar });
    transfer::share_object(series);
    id
}

public fun create_drop<T>(
    _: &OrganiserCap,
    series: &mut Series,
    title: String,
    items: u64,
    price: u64,
    closes_at_ms: u64,
    payout: address,
    clock: &Clock,
    ctx: &mut TxContext,
): ID {
    assert!(items >= 1 && items <= MAX_ITEMS, EInvalidItems);
    assert!(closes_at_ms > clock.timestamp_ms(), EClosesInPast);
    assert!(series.active_drop.is_none(), ESeriesBusy);
    let drop = Drop<T> {
        id: object::new(ctx),
        series: object::id(series),
        title,
        items,
        price,
        closes_at_ms,
        payout,
        entries: vector[],
        entered: table::new(ctx),
        escrow: balance::zero(),
        seed: option::none(),
        winners: vector[],
        settled: false,
    };
    let id = object::id(&drop);
    series.active_drop = option::some(id);
    event::emit(DropCreated {
        drop: id,
        series: drop.series,
        title,
        items,
        price,
        closes_at_ms,
        payout,
    });
    transfer::share_object(drop);
    id
}

// === Entry ===

/// Server-registered entry for a free drop, after the server has verified World ID.
/// `payer` receives the Ticket if the code wins; @0x0 means no ticket.
public fun register<T>(
    _: &OrganiserCap,
    drop: &mut Drop<T>,
    series: &Series,
    code: vector<u8>,
    payer: address,
    clock: &Clock,
) {
    assert!(drop.price == 0, EPaidDrop);
    admit(drop, series, code, payer, 0, clock);
}

/// Fan-signed entry: the sender locks `deposit` (exactly the price) under a registrar
/// permit over `permit_message(drop, code, sender)`.
public fun enter<T>(
    drop: &mut Drop<T>,
    series: &Series,
    code: vector<u8>,
    signature: vector<u8>,
    deposit: Coin<T>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(drop.series == object::id(series), EWrongSeries);
    assert!(deposit.value() == drop.price, EWrongDeposit);
    let message = permit_message(object::id(drop), code, ctx.sender());
    assert!(ed25519::ed25519_verify(&signature, &series.registrar, &message), EBadPermit);
    let price = drop.price;
    admit(drop, series, code, ctx.sender(), price, clock);
    drop.escrow.join(deposit.into_balance());
}

/// The exact bytes a registrar signs to admit `sender` with `code` into `drop`:
/// b"tenjo:enter:v1" (14 bytes) || drop ID (32) || code (16) || sender address (32).
public fun permit_message(drop: ID, code: vector<u8>, sender: address): vector<u8> {
    let mut message = PERMIT_TAG;
    message.append(object::id_to_bytes(&drop));
    message.append(code);
    message.append(sender.to_bytes());
    message
}

fun admit<T>(
    drop: &mut Drop<T>,
    series: &Series,
    code: vector<u8>,
    payer: address,
    paid: u64,
    clock: &Clock,
) {
    assert!(drop.series == object::id(series), EWrongSeries);
    assert!(clock.timestamp_ms() < drop.closes_at_ms, EEntryClosed);
    assert!(code.length() == CODE_LENGTH, EInvalidCode);
    assert!(!drop.entered.contains(code), EAlreadyEntered);
    assert!(drop.entries.length() < MAX_ENTRANTS, EDropFull);
    let losses = losses_of(series, &code);
    let chances = chances_for(losses);
    drop.entered.add(code, true);
    event::emit(Entered {
        drop: object::id(drop),
        code,
        losses,
        chances,
        payer,
        paid,
        position: drop.entries.length(),
    });
    drop.entries.push_back(Entry { code, chances, payer, paid });
}

// === Draw and settlement ===

/// Commits a 32-byte seed from Sui randomness after close, once. Gas does not depend
/// on the outcome: the winners are only computed by `settle`.
entry fun draw<T>(drop: &mut Drop<T>, r: &Random, clock: &Clock, ctx: &mut TxContext) {
    assert!(clock.timestamp_ms() >= drop.closes_at_ms, ETooEarly);
    assert!(drop.seed.is_none(), EAlreadyDrawn);
    let mut generator = random::new_generator(r, ctx);
    let seed = generator.generate_bytes(SEED_LENGTH);
    drop.seed.fill(seed);
    event::emit(Drawn {
        drop: object::id(drop),
        seed,
        entrants: drop.entries.length(),
        total_chances: total_chances(&drop.entries),
    });
}

/// Deterministic from the seed; anyone may call it once the drop is drawn.
///
/// Weighted sampling without replacement. For pick i = 0 .. min(items, entrants) - 1:
///   roll_i = u64 little-endian from the first 8 bytes of blake2b256(seed || bcs(i as u64)),
///            modulo the chances still in the pool;
///   walk the unpicked entries in entry order, adding each one's chances to a cursor, and
///   pick the first entry whose cursor exceeds roll_i. Its chances then leave the pool.
public fun settle<T>(drop: &mut Drop<T>, series: &mut Series, ctx: &mut TxContext) {
    assert!(drop.series == object::id(series), EWrongSeries);
    assert!(drop.seed.is_some(), ENotDrawn);
    assert!(!drop.settled, EAlreadySettled);
    let seed = *drop.seed.borrow();
    let entrants = drop.entries.length();
    let quantity = entrants.min(drop.items);
    // 1-based pick order per entry; 0 = not picked.
    let mut picks = vector::tabulate!(entrants, |_| 0);
    let mut remaining = total_chances(&drop.entries);
    let mut winners = vector[];
    let mut rolls = vector[];
    let mut pools = vector[];
    let mut i = 0;
    while (i < quantity) {
        let roll = roll_at(&seed, i) % remaining;
        let mut j = 0;
        let mut cursor = 0;
        loop {
            if (picks[j] == 0) {
                cursor = cursor + drop.entries[j].chances;
                if (roll < cursor) break
            };
            j = j + 1;
        };
        *&mut picks[j] = i + 1;
        winners.push_back(drop.entries[j].code);
        rolls.push_back(roll);
        pools.push_back(remaining);
        remaining = remaining - drop.entries[j].chances;
        i = i + 1;
    };

    let drop_id = object::id(drop);
    let mut outcomes = vector[];
    let mut total_refunded = 0;
    let mut total_paid_out = 0;
    let mut j = 0;
    while (j < entrants) {
        let entry = drop.entries[j];
        let pick = picks[j];
        let losses_before = losses_of(series, &entry.code);
        let losses_after = if (pick > 0) 0 else losses_before + 1;
        set_losses(series, entry.code, losses_after);
        let mut refunded = 0;
        if (pick > 0) {
            total_paid_out = total_paid_out + entry.paid;
            if (entry.payer != @0x0) {
                let ticket = Ticket {
                    id: object::new(ctx),
                    drop: drop_id,
                    code: entry.code,
                    title: drop.title,
                    pick,
                };
                transfer::transfer(ticket, entry.payer);
            };
        } else if (entry.paid > 0) {
            refunded = entry.paid;
            total_refunded = total_refunded + refunded;
            let refund = coin::from_balance(drop.escrow.split(refunded), ctx);
            transfer::public_transfer(refund, entry.payer);
        };
        outcomes.push_back(Outcome {
            code: entry.code,
            chances: entry.chances,
            losses_before,
            losses_after,
            pick,
            refunded,
        });
        j = j + 1;
    };
    if (total_paid_out > 0) {
        let payment = coin::from_balance(drop.escrow.split(total_paid_out), ctx);
        transfer::public_transfer(payment, drop.payout);
    };
    drop.winners = winners;
    drop.settled = true;
    series.active_drop = option::none();
    event::emit(Settled {
        drop: drop_id,
        series: drop.series,
        seed,
        winners,
        rolls,
        pools,
        outcomes,
        unallocated: drop.items - quantity,
        total_refunded,
        total_paid_out,
        payout: drop.payout,
    });
}

// === Reads ===

public fun chances_for(losses: u64): u64 { 1 + losses.min(MAX_EXTRA) }

public fun losses_of(series: &Series, code: &vector<u8>): u64 {
    if (series.losses.contains(*code)) *series.losses.borrow(*code) else 0
}

public fun active_drop(series: &Series): Option<ID> { series.active_drop }

public fun registrar(series: &Series): vector<u8> { series.registrar }

public fun series_of<T>(drop: &Drop<T>): ID { drop.series }

public fun price<T>(drop: &Drop<T>): u64 { drop.price }

public fun entrants<T>(drop: &Drop<T>): u64 { drop.entries.length() }

public fun entry_at<T>(drop: &Drop<T>, i: u64): (vector<u8>, u64, address, u64) {
    let entry = drop.entries[i];
    (entry.code, entry.chances, entry.payer, entry.paid)
}

public fun escrow_value<T>(drop: &Drop<T>): u64 { drop.escrow.value() }

public fun seed<T>(drop: &Drop<T>): Option<vector<u8>> { drop.seed }

public fun winners<T>(drop: &Drop<T>): vector<vector<u8>> { drop.winners }

public fun is_settled<T>(drop: &Drop<T>): bool { drop.settled }

public fun ticket_drop(ticket: &Ticket): ID { ticket.drop }

public fun ticket_code(ticket: &Ticket): vector<u8> { ticket.code }

public fun ticket_pick(ticket: &Ticket): u64 { ticket.pick }

// === Internals ===

fun total_chances(entries: &vector<Entry>): u64 {
    let mut total = 0;
    entries.do_ref!(|entry| total = total + entry.chances);
    total
}

fun roll_at(seed: &vector<u8>, i: u64): u64 {
    let mut data = *seed;
    data.append(bcs::to_bytes(&i));
    bcs::new(hash::blake2b256(&data)).peel_u64()
}

fun set_losses(series: &mut Series, code: vector<u8>, losses: u64) {
    if (series.losses.contains(code)) *series.losses.borrow_mut(code) = losses
    else if (losses > 0) series.losses.add(code, losses);
}

// === Test helpers ===

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) { init(BALLOT {}, ctx) }

#[test_only]
public fun set_seed_for_testing<T>(drop: &mut Drop<T>, seed: vector<u8>) {
    drop.seed = option::some(seed)
}

#[test_only]
public fun roll_for_testing(seed: vector<u8>, i: u64): u64 { roll_at(&seed, i) }

#[test_only]
public fun set_losses_for_testing(series: &mut Series, code: vector<u8>, losses: u64) {
    set_losses(series, code, losses)
}
