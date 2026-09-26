#[test_only]
module tenjo::ballot_tests;

use sui::clock::{Self, Clock};
use sui::coin::{Self, Coin};
use sui::random::{Self, Random};
use sui::sui::SUI;
use sui::test_scenario::{Self as ts, Scenario};
use tenjo::ballot::{Self, Drop, OrganiserCap, Series, Ticket};

const ORGANISER: address = @0xA11CE;
const PAYOUT: address = @0xB0B;
const FAN_A: address = @0xFA;
const FAN_B: address = @0xFB;
const FAN_C: address = @0xFC;
const CLOSES_AT: u64 = 1_000_000;
const PRICE: u64 = 10_000_000;

// Ed25519 vectors printed by scripts/sui-test-vectors.ts (fixed test-only seed 0x07 * 32),
// signing ballot::permit_message for the first drop of `start` (the same ID in every test).
const REGISTRAR: vector<u8> = x"ea4a6c63e29c520abef5507b132ec5f9954776aebebe7b92421eea691446d22c";
const PERMIT_A: vector<u8> =
    x"87d972fb34eb9e9a72636e4d355ce92e80fd787b039e68ac161f3dc34b58def861a5fb49439cdd38bbfd923f24d323bbc68b4f86be3276a086c2db36df3f4b0e";
const PERMIT_B: vector<u8> =
    x"19f39fbb22da6f047cad0713e3d758bb7bdc657e838c5fd27b85eca634de8818a98f63282809748b1644b85420fbe2e17b6bdd96752fed59d73008bde26baa03";
const PERMIT_C: vector<u8> =
    x"0e6cefd32a3634b98f9595bf328a9a651ce801f29ecebaf33abb344d9b5a5b80fd4287b393cf0a672d2cc45c00bd86b487ba2a8acac37d4b8573aa918a95e20b";
const FIRST_DROP: address = @0x1611edd9a9d42dbcd9ae773ffa22be0f6017b00590959dd5c767e4efcd34cd0b;

fun code(byte: u8): vector<u8> { vector::tabulate!(16, |_| byte) }

fun start(items: u64, price: u64): (Scenario, Clock) {
    let mut scenario = ts::begin(@0x0);
    random::create_for_testing(scenario.ctx());
    let clock = clock::create_for_testing(scenario.ctx());
    scenario.next_tx(@0x0);
    {
        let mut r = scenario.take_shared<Random>();
        r.update_randomness_state_for_testing(
            0,
            x"1f2e3d4c5b6a79881f2e3d4c5b6a79881f2e3d4c5b6a79881f2e3d4c5b6a7988",
            scenario.ctx(),
        );
        ts::return_shared(r);
    };
    scenario.next_tx(ORGANISER);
    ballot::init_for_testing(scenario.ctx());
    scenario.next_tx(ORGANISER);
    {
        let cap = scenario.take_from_sender<OrganiserCap>();
        ballot::create_series(&cap, b"Weekend tour".to_string(), REGISTRAR, scenario.ctx());
        scenario.return_to_sender(cap);
    };
    new_drop(&mut scenario, &clock, items, price);
    (scenario, clock)
}

fun new_drop(scenario: &mut Scenario, clock: &Clock, items: u64, price: u64) {
    scenario.next_tx(ORGANISER);
    let cap = scenario.take_from_sender<OrganiserCap>();
    let mut series = scenario.take_shared<Series>();
    ballot::create_drop<SUI>(
        &cap,
        &mut series,
        b"Console drop".to_string(),
        items,
        price,
        clock.timestamp_ms() + CLOSES_AT,
        PAYOUT,
        clock,
        scenario.ctx(),
    );
    ts::return_shared(series);
    scenario.return_to_sender(cap);
}

fun register(scenario: &mut Scenario, clock: &Clock, code: vector<u8>, payer: address) {
    scenario.next_tx(ORGANISER);
    let cap = scenario.take_from_sender<OrganiserCap>();
    let series = scenario.take_shared<Series>();
    let mut drop = scenario.take_shared<Drop<SUI>>();
    ballot::register(&cap, &mut drop, &series, code, payer, clock);
    ts::return_shared(drop);
    ts::return_shared(series);
    scenario.return_to_sender(cap);
}

fun enter(
    scenario: &mut Scenario,
    clock: &Clock,
    fan: address,
    code: vector<u8>,
    permit: vector<u8>,
    amount: u64,
) {
    scenario.next_tx(fan);
    let series = scenario.take_shared<Series>();
    let mut drop = scenario.take_shared<Drop<SUI>>();
    let deposit = coin::mint_for_testing<SUI>(amount, scenario.ctx());
    ballot::enter(&mut drop, &series, code, permit, deposit, clock, scenario.ctx());
    ts::return_shared(drop);
    ts::return_shared(series);
}

fun set_losses(scenario: &mut Scenario, code: vector<u8>, losses: u64) {
    scenario.next_tx(ORGANISER);
    let mut series = scenario.take_shared<Series>();
    ballot::set_losses_for_testing(&mut series, code, losses);
    ts::return_shared(series);
}

fun draw(scenario: &mut Scenario, clock: &Clock) {
    scenario.next_tx(ORGANISER);
    let r = scenario.take_shared<Random>();
    let mut drop = scenario.take_shared<Drop<SUI>>();
    ballot::draw(&mut drop, &r, clock, scenario.ctx());
    ts::return_shared(drop);
    ts::return_shared(r);
}

fun seed(scenario: &mut Scenario, value: vector<u8>) {
    scenario.next_tx(ORGANISER);
    let mut drop = scenario.take_shared<Drop<SUI>>();
    ballot::set_seed_for_testing(&mut drop, value);
    ts::return_shared(drop);
}

fun settle(scenario: &mut Scenario) {
    scenario.next_tx(ORGANISER);
    let mut series = scenario.take_shared<Series>();
    let mut drop = scenario.take_shared<Drop<SUI>>();
    ballot::settle(&mut drop, &mut series, scenario.ctx());
    ts::return_shared(drop);
    ts::return_shared(series);
}

fun losses(scenario: &mut Scenario, code: vector<u8>): u64 {
    scenario.next_tx(ORGANISER);
    let series = scenario.take_shared<Series>();
    let value = series.losses_of(&code);
    ts::return_shared(series);
    value
}

fun finish(scenario: Scenario, clock: Clock) {
    clock.destroy_for_testing();
    scenario.end();
}

#[test]
fun first_drop_matches_the_signed_vectors() {
    let (mut scenario, clock) = start(1, PRICE);
    scenario.next_tx(ORGANISER);
    let drop = scenario.take_shared<Drop<SUI>>();
    assert!(object::id(&drop) == object::id_from_address(FIRST_DROP));
    ts::return_shared(drop);
    finish(scenario, clock);
}

#[test]
fun chances_follow_the_ledger_and_cap_at_six() {
    let (mut scenario, clock) = start(1, 0);
    set_losses(&mut scenario, code(2), 3);
    set_losses(&mut scenario, code(3), 5);
    set_losses(&mut scenario, code(4), 9);
    register(&mut scenario, &clock, code(1), FAN_A);
    register(&mut scenario, &clock, code(2), FAN_B);
    register(&mut scenario, &clock, code(3), FAN_C);
    register(&mut scenario, &clock, code(4), @0x0);
    scenario.next_tx(ORGANISER);
    let drop = scenario.take_shared<Drop<SUI>>();
    let expected = vector[1, 4, 6, 6];
    expected.length().do!(|i| {
        let (_, chances, _, paid) = drop.entry_at(i);
        assert!(chances == expected[i]);
        assert!(paid == 0);
    });
    assert!(drop.entrants() == 4);
    ts::return_shared(drop);
    assert!(ballot::chances_for(0) == 1);
    assert!(ballot::chances_for(5) == 6);
    assert!(ballot::chances_for(100) == 6);
    finish(scenario, clock);
}

#[test]
fun losers_gain_a_chance_and_winners_reset() {
    let (mut scenario, mut clock) = start(1, 0);
    set_losses(&mut scenario, code(0x0b), 2);
    register(&mut scenario, &clock, code(0x0a), FAN_A);
    register(&mut scenario, &clock, code(0x0b), FAN_B);
    clock.set_for_testing(CLOSES_AT);
    // tests/sui-draw.test.ts: with this seed the second of two equal entries wins.
    seed(&mut scenario, vector::tabulate!(32, |_| 5));
    settle(&mut scenario);
    scenario.next_tx(ORGANISER);
    {
        let series = scenario.take_shared<Series>();
        let drop = scenario.take_shared<Drop<SUI>>();
        assert!(drop.is_settled());
        assert!(drop.winners() == vector[code(0x0b)]);
        assert!(series.losses_of(&code(0x0a)) == 1);
        assert!(series.losses_of(&code(0x0b)) == 0);
        assert!(series.active_drop().is_none());
        ts::return_shared(drop);
        ts::return_shared(series);
    };
    let ticket = scenario.take_from_address<Ticket>(FAN_B);
    assert!(ticket.ticket_code() == code(0x0b));
    assert!(ticket.ticket_pick() == 1);
    assert!(ticket.ticket_drop() == object::id_from_address(FIRST_DROP));
    ts::return_to_address(FAN_B, ticket);
    assert!(!ts::has_most_recent_for_address<Ticket>(FAN_A));

    // The next drop in the series is allowed and weighs A's loss.
    new_drop(&mut scenario, &clock, 1, 0);
    register(&mut scenario, &clock, code(0x0a), FAN_A);
    register(&mut scenario, &clock, code(0x0b), FAN_B);
    scenario.next_tx(ORGANISER);
    let drop = scenario.take_shared<Drop<SUI>>();
    let (_, a_chances, _, _) = drop.entry_at(0);
    let (_, b_chances, _, _) = drop.entry_at(1);
    assert!(a_chances == 2);
    assert!(b_chances == 1);
    ts::return_shared(drop);
    finish(scenario, clock);
}

#[test]
fun settle_matches_the_off_chain_vector() {
    let (mut scenario, mut clock) = start(3, 0);
    let prior = vector[0, 3, 7, 1, 2];
    5u64.do!(|i| set_losses(&mut scenario, code((i + 1) as u8), prior[i]));
    5u64.do!(|i| register(&mut scenario, &clock, code((i + 1) as u8), @0x0));
    clock.set_for_testing(CLOSES_AT);
    let value = vector::tabulate!(32, |i| i as u8);
    assert!(ballot::roll_for_testing(value, 0) == 14226606488660556411);
    assert!(ballot::roll_for_testing(value, 1) == 953125110871885741);
    assert!(ballot::roll_for_testing(value, 2) == 10036584550145026715);
    seed(&mut scenario, value);
    settle(&mut scenario);
    scenario.next_tx(ORGANISER);
    let drop = scenario.take_shared<Drop<SUI>>();
    assert!(drop.winners() == vector[code(4), code(5), code(3)]);
    ts::return_shared(drop);
    let after = vector[1, 4, 0, 0, 0];
    5u64.do!(|i| assert!(losses(&mut scenario, code((i + 1) as u8)) == after[i]));
    finish(scenario, clock);
}

#[test]
fun fewer_entrants_than_items_all_win() {
    let (mut scenario, mut clock) = start(3, 0);
    set_losses(&mut scenario, code(1), 2);
    register(&mut scenario, &clock, code(1), FAN_A);
    register(&mut scenario, &clock, code(2), @0x0);
    clock.set_for_testing(CLOSES_AT);
    draw(&mut scenario, &clock);
    settle(&mut scenario);
    scenario.next_tx(ORGANISER);
    let drop = scenario.take_shared<Drop<SUI>>();
    let winners = drop.winners();
    assert!(winners.length() == 2);
    assert!(winners.contains(&code(1)));
    assert!(winners.contains(&code(2)));
    ts::return_shared(drop);
    assert!(losses(&mut scenario, code(1)) == 0);
    assert!(losses(&mut scenario, code(2)) == 0);
    assert!(ts::has_most_recent_for_address<Ticket>(FAN_A));
    assert!(!ts::has_most_recent_for_address<Ticket>(@0x0));
    finish(scenario, clock);
}

#[test]
fun empty_drop_settles_and_frees_the_series() {
    let (mut scenario, mut clock) = start(2, 0);
    clock.set_for_testing(CLOSES_AT);
    draw(&mut scenario, &clock);
    settle(&mut scenario);
    scenario.next_tx(ORGANISER);
    let series = scenario.take_shared<Series>();
    assert!(series.active_drop().is_none());
    ts::return_shared(series);
    finish(scenario, clock);
}

#[test]
fun paid_drop_pays_the_organiser_and_refunds_losers() {
    let (mut scenario, mut clock) = start(1, PRICE);
    set_losses(&mut scenario, code(0xa1), 4);
    enter(&mut scenario, &clock, FAN_A, code(0xa1), PERMIT_A, PRICE);
    enter(&mut scenario, &clock, FAN_B, code(0xb2), PERMIT_B, PRICE);
    enter(&mut scenario, &clock, FAN_C, code(0xc3), PERMIT_C, PRICE);
    scenario.next_tx(ORGANISER);
    {
        let drop = scenario.take_shared<Drop<SUI>>();
        assert!(drop.escrow_value() == 3 * PRICE);
        let (_, chances, payer, paid) = drop.entry_at(0);
        assert!(chances == 5);
        assert!(payer == FAN_A);
        assert!(paid == PRICE);
        ts::return_shared(drop);
    };
    clock.set_for_testing(CLOSES_AT);
    draw(&mut scenario, &clock);
    settle(&mut scenario);
    scenario.next_tx(ORGANISER);
    let drop = scenario.take_shared<Drop<SUI>>();
    assert!(drop.escrow_value() == 0);
    let winners = drop.winners();
    assert!(winners.length() == 1);
    ts::return_shared(drop);
    let payment = scenario.take_from_address<Coin<SUI>>(PAYOUT);
    assert!(payment.value() == PRICE);
    ts::return_to_address(PAYOUT, payment);
    let fans = vector[FAN_A, FAN_B, FAN_C];
    let codes = vector[code(0xa1), code(0xb2), code(0xc3)];
    3u64.do!(|i| {
        let fan = fans[i];
        if (codes[i] == winners[0]) {
            assert!(ts::has_most_recent_for_address<Ticket>(fan));
            assert!(!ts::has_most_recent_for_address<Coin<SUI>>(fan));
            assert!(losses(&mut scenario, codes[i]) == 0);
        } else {
            let refund = scenario.take_from_address<Coin<SUI>>(fan);
            assert!(refund.value() == PRICE);
            ts::return_to_address(fan, refund);
            assert!(!ts::has_most_recent_for_address<Ticket>(fan));
            let before = if (i == 0) 4 else 0;
            assert!(losses(&mut scenario, codes[i]) == before + 1);
        }
    });
    finish(scenario, clock);
}

#[test]
fun a_full_drop_settles_in_one_transaction() {
    let (mut scenario, mut clock) = start(150, 0);
    300u64.do!(|i| {
        let mut value = code((i % 256) as u8);
        *&mut value[0] = ((i / 256) as u8);
        register(&mut scenario, &clock, value, @0x0);
    });
    clock.set_for_testing(CLOSES_AT);
    draw(&mut scenario, &clock);
    settle(&mut scenario);
    scenario.next_tx(ORGANISER);
    let drop = scenario.take_shared<Drop<SUI>>();
    assert!(drop.winners().length() == 150);
    ts::return_shared(drop);
    finish(scenario, clock);
}

#[test, expected_failure(abort_code = ballot::EDropFull)]
fun entrant_301_refused() {
    let (mut scenario, clock) = start(1, 0);
    301u64.do!(|i| {
        let mut value = code((i % 256) as u8);
        *&mut value[0] = ((i / 256) as u8);
        register(&mut scenario, &clock, value, @0x0);
    });
    finish(scenario, clock);
}

#[test, expected_failure(abort_code = ballot::EAlreadyEntered)]
fun duplicate_code_refused() {
    let (mut scenario, clock) = start(1, 0);
    register(&mut scenario, &clock, code(1), FAN_A);
    register(&mut scenario, &clock, code(1), FAN_B);
    finish(scenario, clock);
}

#[test, expected_failure(abort_code = ballot::EEntryClosed)]
fun entry_after_close_refused() {
    let (mut scenario, mut clock) = start(1, 0);
    clock.set_for_testing(CLOSES_AT);
    register(&mut scenario, &clock, code(1), FAN_A);
    finish(scenario, clock);
}

#[test, expected_failure(abort_code = ballot::EInvalidCode)]
fun short_code_refused() {
    let (mut scenario, clock) = start(1, 0);
    register(&mut scenario, &clock, x"0102", FAN_A);
    finish(scenario, clock);
}

#[test, expected_failure(abort_code = ballot::EPaidDrop)]
fun paid_drop_needs_a_fan_signed_entry() {
    let (mut scenario, clock) = start(1, PRICE);
    register(&mut scenario, &clock, code(1), FAN_A);
    finish(scenario, clock);
}

#[test, expected_failure(abort_code = ballot::EBadPermit)]
fun permit_for_another_sender_refused() {
    let (mut scenario, clock) = start(1, PRICE);
    enter(&mut scenario, &clock, FAN_B, code(0xa1), PERMIT_A, PRICE);
    finish(scenario, clock);
}

#[test, expected_failure(abort_code = ballot::EBadPermit)]
fun permit_for_another_code_refused() {
    let (mut scenario, clock) = start(1, PRICE);
    enter(&mut scenario, &clock, FAN_A, code(0xb2), PERMIT_A, PRICE);
    finish(scenario, clock);
}

#[test, expected_failure(abort_code = ballot::EWrongDeposit)]
fun wrong_deposit_refused() {
    let (mut scenario, clock) = start(1, PRICE);
    enter(&mut scenario, &clock, FAN_A, code(0xa1), PERMIT_A, PRICE - 1);
    finish(scenario, clock);
}

#[test, expected_failure(abort_code = ballot::ETooEarly)]
fun draw_before_close_refused() {
    let (mut scenario, clock) = start(1, 0);
    register(&mut scenario, &clock, code(1), FAN_A);
    draw(&mut scenario, &clock);
    finish(scenario, clock);
}

#[test, expected_failure(abort_code = ballot::EAlreadyDrawn)]
fun draw_twice_refused() {
    let (mut scenario, mut clock) = start(1, 0);
    register(&mut scenario, &clock, code(1), FAN_A);
    clock.set_for_testing(CLOSES_AT);
    draw(&mut scenario, &clock);
    draw(&mut scenario, &clock);
    finish(scenario, clock);
}

#[test, expected_failure(abort_code = ballot::ENotDrawn)]
fun settle_before_draw_refused() {
    let (mut scenario, mut clock) = start(1, 0);
    register(&mut scenario, &clock, code(1), FAN_A);
    clock.set_for_testing(CLOSES_AT);
    settle(&mut scenario);
    finish(scenario, clock);
}

#[test, expected_failure(abort_code = ballot::EAlreadySettled)]
fun settle_twice_refused() {
    let (mut scenario, mut clock) = start(1, 0);
    register(&mut scenario, &clock, code(1), FAN_A);
    clock.set_for_testing(CLOSES_AT);
    draw(&mut scenario, &clock);
    settle(&mut scenario);
    settle(&mut scenario);
    finish(scenario, clock);
}

#[test, expected_failure(abort_code = ballot::ESeriesBusy)]
fun second_drop_refused_while_one_is_active() {
    let (mut scenario, clock) = start(1, 0);
    new_drop(&mut scenario, &clock, 1, 0);
    finish(scenario, clock);
}

#[test, expected_failure(abort_code = ballot::EInvalidItems)]
fun zero_items_refused() {
    let (mut scenario, clock) = start(0, 0);
    finish(scenario, clock);
}
