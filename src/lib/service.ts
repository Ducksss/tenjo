import { createHash, randomUUID } from "node:crypto";
import {
  isValidTransactionDigest,
  normalizeSuiAddress,
  parseToMist,
} from "@mysten/sui/utils";
import { z } from "zod";
import type { Database, SQL } from "./db";
import {
  AppError,
  canonicalJson,
  MAX_ENTRANTS,
  ticketsFor,
  weightedDraw,
  type Drop,
  type WeightedEntry,
} from "./domain";
import { ENTRY_GRACE_MS, SUI_COIN, suiChain, suiConfig } from "./sui";
import { explorable, suiscan } from "./sui-status";

const MAX_PRICE_MIST = BigInt("1000000000000000"); // 1,000,000 SUI
const priceSchema = z
  .union([z.number().nonnegative(), z.string().trim()])
  .transform(String)
  .refine((v) => /^\d{1,7}(\.\d{1,9})?$/.test(v), {
    message: "Enter the entry price in SUI, for example 0.01.",
  });
const mistSchema = z
  .union([
    z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    z.string().regex(/^\d{1,16}$/),
  ])
  .transform((v) => BigInt(v).toString());
/** Deposit in MIST, or null while a price field is invalid (refinements see raw input). */
function priceOf(d: { price?: unknown; price_mist?: unknown }) {
  try {
    if (d.price_mist !== undefined)
      return BigInt(d.price_mist as string).toString();
    if (d.price === undefined) return "0";
    const text = String(d.price);
    return /^\d{1,7}(\.\d{1,9})?$/.test(text)
      ? parseToMist(text).toString()
      : null;
  } catch {
    return null;
  }
}

export const createDropSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().max(1000).default(""),
    /** Optional: without it, the series is found or created by name (seriesIdFor). */
    series_id: z
      .string()
      .regex(/^[a-z0-9-]{1,64}$/)
      .optional(),
    series_name: z.string().trim().min(2).max(100),
    items: z.number().int().min(1).max(300),
    opens_at: z.iso.datetime({ offset: true }),
    closes_at: z.iso.datetime({ offset: true }),
    /** Refundable deposit per entry, in SUI ("0.01"). Default 0: a free drop. */
    price: priceSchema.optional(),
    /** The same deposit in MIST; use one of price or price_mist. */
    price_mist: mistSchema.optional(),
  })
  .refine((d) => Date.parse(d.closes_at) > Date.parse(d.opens_at), {
    message: "Closing time must be after opening time.",
    path: ["closes_at"],
  })
  .refine(
    (d) =>
      d.price === undefined ||
      d.price_mist === undefined ||
      priceOf({ price: d.price }) === priceOf({ price_mist: d.price_mist }),
    { message: "The price in SUI and in MIST disagree.", path: ["price"] },
  )
  .refine(
    (d) => {
      const mist = priceOf(d);
      return mist === null || BigInt(mist) <= MAX_PRICE_MIST;
    },
    { message: "The entry price is too high.", path: ["price"] },
  );

const dropColumns = `d.*, (d.state='open' AND now()>=d.opens_at AND now()<d.closes_at) AS entry_open, s.name AS series_name, s.sui_series_id, s.sui_package_id, (SELECT count(*)::int FROM entries e WHERE e.drop_id=d.id) AS entry_count, (SELECT coalesce(sum(e.tickets),0)::int FROM entries e WHERE e.drop_id=d.id) AS ticket_count`;
// Postgres drivers disagree on numeric parsing; the API always carries MIST as a decimal string.
const withPrice = (drop: Drop): Drop => ({
  ...drop,
  price_mist: String(drop.price_mist ?? 0),
});
export async function getDrop(db: SQL, id: string): Promise<Drop> {
  const { rows } = await db.query<Drop>(
    `SELECT ${dropColumns} FROM drops d JOIN series s ON s.id=d.series_id WHERE d.id=$1`,
    [id],
  );
  if (!rows[0]) throw new AppError(404, "not_found", "Drop not found.");
  return withPrice(rows[0]);
}
/** Newest first. Discovery passes openFirst so a drop fans can still enter is always featured. */
export async function listDrops(
  db: SQL,
  limit = 20,
  offset = 0,
  openFirst = false,
) {
  return (
    await db.query<Drop>(
      `SELECT ${dropColumns} FROM drops d JOIN series s ON s.id=d.series_id WHERE NOT d.is_setup ORDER BY ${openFirst ? "entry_open DESC, " : ""}d.opens_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset],
    )
  ).rows.map(withPrice);
}
async function lockSeries(db: SQL, dropId: string) {
  const d = await getDrop(db, dropId);
  await db.query("SELECT id FROM series WHERE id=$1 FOR UPDATE", [d.series_id]);
  await db.query("SELECT id FROM drops WHERE id=$1 FOR UPDATE", [dropId]);
  return getDrop(db, dropId);
}
/**
 * Organisers name a series; they never type its ID. The same name, in any case, continues the
 * most recently used series with that name. A new name gets a readable slug, or a hash when the
 * name has no Latin letters (a Japanese tour name), with a suffix if another series holds it.
 */
async function seriesIdFor(tx: SQL, name: string) {
  const existing = await tx.query<{ id: string }>(
    "SELECT s.id FROM series s LEFT JOIN drops d ON d.series_id=s.id WHERE lower(s.name)=lower($1) GROUP BY s.id ORDER BY max(d.opens_at) DESC NULLS LAST, s.id LIMIT 1",
    [name],
  );
  if (existing.rows[0]) return existing.rows[0].id;
  const base =
    name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+/, "")
      .slice(0, 48)
      .replace(/-+$/, "") ||
    `series-${createHash("sha256").update(name).digest("hex").slice(0, 8)}`;
  let id = base;
  for (let n = 2; ; n++) {
    const taken = await tx.query("SELECT 1 FROM series WHERE id=$1", [id]);
    if (!taken.rows.length) return id;
    id = `${base}-${n}`;
  }
}
export type SeriesOption = {
  id: string;
  name: string;
  drops: number;
  /** A drop that hasn't settled yet: the series can't take another until it does. */
  busy: boolean;
};
/** Recently active series for the organiser form, one per name (the one seriesIdFor would pick). */
export async function listSeries(db: SQL, limit = 8): Promise<SeriesOption[]> {
  const { rows } = await db.query<SeriesOption & { last: string | null }>(
    "SELECT s.id, s.name, count(d.id)::int AS drops, coalesce(bool_or(d.state<>'settled'),false) AS busy, max(d.opens_at) AS last FROM series s LEFT JOIN drops d ON d.series_id=s.id GROUP BY s.id, s.name ORDER BY max(d.opens_at) DESC NULLS LAST, s.id",
  );
  const seen = new Set<string>();
  return rows
    .filter((s) => {
      const key = s.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit)
    .map(({ id, name, drops, busy }) => ({ id, name, drops, busy }));
}
/** Serialises organiser-signed Sui transactions across processes, so gas coins never race. */
const chainLock = (tx: SQL) =>
  tx.query("SELECT pg_advisory_xact_lock(hashtext('tenjo:sui'))");
const onChain = (drop: Drop) => !!drop.sui_drop_id && !!drop.sui_series_id;

export async function createDrop(
  db: Database,
  raw: unknown,
  options: { demo?: boolean; setup?: boolean; id?: string } = {},
) {
  const data = createDropSchema.parse(raw);
  const priceMist = priceOf(data)!;
  const sui = suiConfig();
  // Setup history uses scripted picks, which the chain cannot reproduce: it stays off-chain.
  const useChain = sui.ready && !options.setup;
  if (priceMist !== "0" && !useChain)
    throw new AppError(
      400,
      "sui_required",
      "Priced drops hold refundable deposits on Sui, which is not configured here.",
    );
  return db.transaction(async (tx) => {
    const seriesKey =
      data.series_id ?? (await seriesIdFor(tx, data.series_name));
    await tx.query(
      "INSERT INTO series(id,name) VALUES($1,$2) ON CONFLICT DO NOTHING",
      [seriesKey, data.series_name],
    );
    const series = (
      await tx.query<{
        name: string;
        sui_series_id: string | null;
        sui_package_id: string | null;
      }>(
        "SELECT name,sui_series_id,sui_package_id FROM series WHERE id=$1 FOR UPDATE",
        [seriesKey],
      )
    ).rows[0];
    const pending = await tx.query(
      "SELECT id FROM drops WHERE series_id=$1 AND state<>'settled' LIMIT 1",
      [seriesKey],
    );
    if (pending.rows.length)
      throw new AppError(
        409,
        "series_busy",
        "Settle the current drop in this series before creating the next one.",
      );
    const id = options.id || randomUUID();
    if (!useChain && series.sui_series_id)
      throw new AppError(
        503,
        "sui_not_configured",
        "This series keeps its loss ledger on Sui. Configure Sui to add drops to it.",
      );
    const packageId = sui.packageId && normalizeSuiAddress(sui.packageId);
    if (useChain && series.sui_series_id && series.sui_package_id !== packageId)
      throw new AppError(
        409,
        "sui_series_package",
        "This series was created with another Sui package. Start a new series.",
      );
    // A series joins Sui only before its first drop, so the chain ledger holds its whole history.
    const chain =
      useChain &&
      (!!series.sui_series_id ||
        !(
          await tx.query<{ n: number }>(
            "SELECT count(*)::int AS n FROM drops WHERE series_id=$1",
            [seriesKey],
          )
        ).rows[0].n);
    if (priceMist !== "0" && !chain)
      throw new AppError(
        409,
        "sui_series_history",
        "Priced drops need a series that started on Sui. Use a new series.",
      );
    const closesAtMs = Date.parse(data.closes_at) + ENTRY_GRACE_MS;
    if (chain && closesAtMs <= Date.now())
      throw new AppError(
        400,
        "closes_in_past",
        "Choose a closing time in the future for a drop on Sui.",
      );
    // Insert first: a database refusal must never leave an orphan drop on-chain.
    await tx.query(
      `INSERT INTO drops(id,series_id,title,description,items,opens_at,closes_at,is_demo,is_setup,price_mist) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        id,
        seriesKey,
        data.title,
        data.description,
        data.items,
        data.opens_at,
        data.closes_at,
        !!options.demo,
        !!options.setup,
        priceMist,
      ],
    );
    if (chain) {
      await chainLock(tx);
      const { seriesId } = await suiChain.ensureSeries(
        series.name,
        series.sui_series_id,
      );
      if (!series.sui_series_id)
        await tx.query(
          "UPDATE series SET sui_series_id=$2,sui_package_id=$3 WHERE id=$1",
          [seriesKey, seriesId, packageId],
        );
      const created = await suiChain.createDropOnChain({
        seriesId,
        title: data.title,
        items: data.items,
        priceMist,
        closesAtMs,
      });
      await tx.query(
        "UPDATE drops SET sui_drop_id=$2,sui_create_tx=$3,sui_network=$4,coin_type=$5 WHERE id=$1",
        [id, created.dropId, created.digest, sui.network, SUI_COIN],
      );
    }
    return getDrop(tx, id);
  });
}
export type VerifiedIdentity = {
  code: string;
  challengeId?: string;
  policy?: string;
  demo?: boolean;
};
async function consumeChallenge(
  tx: SQL,
  identity: VerifiedIdentity,
  dropId: string,
  purpose: string,
) {
  if (identity.demo) return;
  if (!identity.policy)
    throw new AppError(
      403,
      "identity_policy",
      "A verified identity policy is required.",
    );
  await tx.query(
    "INSERT INTO identity_policy(singleton,fingerprint) VALUES(true,$1) ON CONFLICT DO NOTHING",
    [identity.policy],
  );
  const policy = (
    await tx.query<{ fingerprint: string }>(
      "SELECT fingerprint FROM identity_policy WHERE singleton=true FOR UPDATE",
    )
  ).rows[0];
  if (policy.fingerprint !== identity.policy)
    throw new AppError(
      503,
      "identity_policy",
      "World identity settings changed after entries were accepted. Restore the original settings or use a new database.",
    );
  const { rows } = await tx.query(
    `UPDATE challenges SET used_at=now() WHERE id=$1 AND drop_id=$2 AND purpose=$3 AND used_at IS NULL AND expires_at>clock_timestamp() RETURNING id`,
    [identity.challengeId, dropId, purpose],
  );
  if (!rows.length)
    throw new AppError(
      409,
      "proof_expired",
      "This verification expired or was already used. Verify again.",
    );
}
/** Shared entry checks; returns the drop and the code's current series losses. */
async function admit(
  tx: SQL,
  id: string,
  identity: VerifiedIdentity,
  now: Date | undefined,
  paid: boolean,
) {
  const drop = await lockSeries(tx, id);
  const currentTime =
    now ??
    new Date(
      (
        await tx.query<{ current_time: string }>(
          "SELECT clock_timestamp() AS current_time",
        )
      ).rows[0].current_time,
    );
  if (drop.is_demo !== !!identity.demo)
    throw new AppError(
      403,
      "identity_mode",
      "Demo identities only work in local demo drops.",
    );
  if (
    drop.state !== "open" ||
    currentTime < new Date(drop.opens_at) ||
    currentTime >= new Date(drop.closes_at)
  )
    throw new AppError(
      409,
      "entry_closed",
      "Entries are not open for this drop.",
    );
  if (paid && (!onChain(drop) || drop.price_mist === "0"))
    throw new AppError(
      409,
      "no_deposit",
      "This drop is free to enter. Enter without a wallet.",
    );
  if (!paid && drop.price_mist !== "0")
    throw new AppError(
      409,
      "deposit_required",
      "This drop takes a refundable deposit. Enter with a Sui wallet.",
    );
  if (
    (
      await tx.query(
        "SELECT 1 FROM entries WHERE drop_id=$1 AND member_code=$2",
        [id, identity.code],
      )
    ).rows.length
  )
    // The proof or demo identity was checked before this, so the code is the requester's own.
    throw new AppError(
      409,
      "already_entered",
      "Already entered. One person gets one entry per drop.",
      { member_code: identity.code },
    );
  if (drop.entry_count >= MAX_ENTRANTS)
    throw new AppError(
      409,
      "drop_full",
      "This demo drop has reached its 300-person limit.",
    );
  await consumeChallenge(tx, identity, id, "enter");
  const losses =
    (
      await tx.query<{ losses: number }>(
        "SELECT losses FROM pity WHERE series_id=$1 AND member_code=$2",
        [drop.series_id, identity.code],
      )
    ).rows[0]?.losses || 0;
  return { drop, losses };
}
export type EntryReceipt = {
  code: string;
  tickets: number;
  losses: number;
  drop_id: string;
  /** On-chain drops only: 'registered' once on Sui, 'pending' while a retry is due. */
  sui_status?: string;
  sui_tx?: string | null;
};
export async function enterDrop(
  db: Database,
  id: string,
  identity: VerifiedIdentity,
  now?: Date,
): Promise<EntryReceipt> {
  const { entry, chain } = await db.transaction(async (tx) => {
    const { drop, losses } = await admit(tx, id, identity, now, false);
    await tx.query(
      "INSERT INTO members(code) VALUES($1) ON CONFLICT DO NOTHING",
      [identity.code],
    );
    const tickets = ticketsFor(losses);
    await tx.query(
      "INSERT INTO entries(drop_id,member_code,tickets,sui_status) VALUES($1,$2,$3,$4)",
      [id, identity.code, tickets, onChain(drop) ? "pending" : null],
    );
    return {
      entry: { code: identity.code, tickets, losses, drop_id: id },
      chain: onChain(drop),
    };
  });
  if (!chain) return entry;
  // After the commit: a Sui failure leaves the entry saved and pending, retried later.
  await registerPending(db, id);
  const { rows } = await db.query<{
    sui_status: string;
    sui_tx: string | null;
  }>(
    "SELECT sui_status,sui_tx FROM entries WHERE drop_id=$1 AND member_code=$2",
    [id, identity.code],
  );
  return { ...entry, ...rows[0] };
}
/** Registers up to ten pending free entries on Sui, oldest first, while the chain still accepts them. */
export async function registerPending(db: Database, id: string) {
  await db.transaction(async (tx) => {
    const drop = await getDrop(tx, id);
    if (
      !onChain(drop) ||
      drop.state !== "open" ||
      drop.price_mist !== "0" ||
      Date.now() >= new Date(drop.closes_at).getTime() + ENTRY_GRACE_MS
    )
      return;
    // Lock first, so the pending list is fresh and concurrent entries never register twice.
    await chainLock(tx);
    const pending = (
      await tx.query<{ member_code: string }>(
        "SELECT member_code FROM entries WHERE drop_id=$1 AND sui_status='pending' ORDER BY created_at,member_code LIMIT 10",
        [id],
      )
    ).rows;
    for (const { member_code } of pending) {
      let digest: string | null;
      try {
        ({ digest } = await suiChain.registerEntryOnChain({
          dropId: drop.sui_drop_id!,
          seriesId: drop.sui_series_id!,
          code: member_code,
        }));
      } catch (error) {
        // Already on-chain (an earlier update was lost): registered, digest unknown.
        if (!(error instanceof AppError && error.code === "already_entered"))
          break;
        digest = null;
      }
      await tx.query(
        "UPDATE entries SET sui_status='registered',sui_tx=coalesce(sui_tx,$3) WHERE drop_id=$1 AND member_code=$2",
        [id, member_code, digest],
      );
    }
  });
}
/** Fast refusal before any identity check: only on-chain drops with a price take deposits. */
export async function requireDepositDrop(db: SQL, id: string) {
  const drop = await getDrop(db, id);
  if (!onChain(drop) || drop.price_mist === "0")
    throw new AppError(
      409,
      "no_deposit",
      "This drop is free to enter. Enter without a wallet.",
    );
  return drop;
}
/** After World ID verification: a registrar permit for `sender` to lock the deposit on Sui. */
export async function permitEntry(
  db: Database,
  id: string,
  identity: VerifiedIdentity,
  sender: string,
  now?: Date,
) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(sender))
    throw new AppError(400, "invalid_address", "Connect a valid Sui wallet.");
  return db.transaction(async (tx) => {
    const { drop, losses } = await admit(tx, id, identity, now, true);
    const permit = await suiChain.issuePermit({
      dropId: drop.sui_drop_id!,
      code: identity.code,
      sender,
    });
    return {
      code: identity.code,
      tickets: ticketsFor(losses),
      losses,
      permit: {
        package_id: drop.sui_package_id,
        drop_object_id: drop.sui_drop_id,
        series_object_id: drop.sui_series_id,
        coin_type: drop.coin_type,
        price_mist: drop.price_mist,
        code_hex: identity.code,
        signature_hex: permit.signature,
        closes_at_ms: new Date(drop.closes_at).getTime() + ENTRY_GRACE_MS,
      },
    };
  });
}
/** Mirrors a fan-signed deposit entry from its Sui transaction. Idempotent. */
export async function confirmEntry(db: Database, id: string, digest: string) {
  if (!isValidTransactionDigest(digest))
    throw new AppError(
      400,
      "invalid_digest",
      "That is not a Sui transaction digest.",
    );
  const drop = await requireDepositDrop(db, id);
  const { sender, entries } = await suiChain.readEntryTx(digest);
  const entry = entries.find(
    (e) =>
      normalizeSuiAddress(e.dropId) ===
        normalizeSuiAddress(drop.sui_drop_id!) &&
      normalizeSuiAddress(e.payer) === normalizeSuiAddress(sender) &&
      e.paid === drop.price_mist,
  );
  if (!entry)
    throw new AppError(
      400,
      "not_an_entry",
      "That transaction is not a deposit entry into this drop.",
    );
  return db.transaction(async (tx) => {
    await lockSeries(tx, id);
    await mirrorEntry(tx, id, entry, digest);
    const { rows } = await tx.query<{ tickets: number; sui_tx: string }>(
      "SELECT tickets,sui_tx FROM entries WHERE drop_id=$1 AND member_code=$2",
      [id, entry.code],
    );
    return {
      code: entry.code,
      tickets: rows[0].tickets,
      digest: rows[0].sui_tx,
    };
  });
}
async function mirrorEntry(
  tx: SQL,
  id: string,
  entry: { code: string; chances: number; payer: string; paid: string },
  digest: string | null,
) {
  await tx.query(
    "INSERT INTO members(code) VALUES($1) ON CONFLICT DO NOTHING",
    [entry.code],
  );
  await tx.query(
    `INSERT INTO entries(drop_id,member_code,tickets,sui_status,sui_tx,payer,paid_mist) VALUES($1,$2,$3,'registered',$4,$5,$6)
     ON CONFLICT(drop_id,member_code) DO UPDATE SET tickets=EXCLUDED.tickets,sui_status='registered',sui_tx=coalesce(entries.sui_tx,EXCLUDED.sui_tx),payer=EXCLUDED.payer,paid_mist=EXCLUDED.paid_mist`,
    [
      id,
      entry.code,
      entry.chances,
      digest,
      entry.payer === normalizeSuiAddress("0x0") ? null : entry.payer,
      entry.paid,
    ],
  );
}
export async function drawDrop(
  db: Database,
  id: string,
  now?: Date,
  random?: (max: number) => number,
) {
  // The chain still accepts entries for ENTRY_GRACE_MS after close: land any pending ones first.
  const before = await getDrop(db, id);
  if (onChain(before) && before.state === "open") await registerPending(db, id);
  return db.transaction(async (tx) => {
    const drop = await lockSeries(tx, id);
    const currentTime =
      now ??
      new Date(
        (
          await tx.query<{ current_time: string }>(
            "SELECT clock_timestamp() AS current_time",
          )
        ).rows[0].current_time,
      );
    const existing = await tx.query<{ record: unknown }>(
      "SELECT record FROM draw_records WHERE drop_id=$1",
      [id],
    );
    if (existing.rows[0]) return existing.rows[0].record;
    if (currentTime < new Date(drop.closes_at))
      throw new AppError(
        409,
        "too_early",
        "Draw not open yet. Wait until entries close.",
      );
    if (drop.state !== "open" && drop.state !== "closed")
      throw new AppError(409, "invalid_state", "This drop cannot be drawn.");
    if (onChain(drop)) return settleFromChain(tx, drop, currentTime);
    const entries = (
      await tx.query<WeightedEntry & { losses: number }>(
        `SELECT e.member_code,e.tickets,COALESCE(p.losses,0)::int AS losses FROM entries e LEFT JOIN pity p ON p.member_code=e.member_code AND p.series_id=$2 WHERE e.drop_id=$1 ORDER BY e.member_code`,
        [id, drop.series_id],
      )
    ).rows;
    const picks = weightedDraw(entries, drop.items, random);
    const result = entries.map((entry) => {
      const pick = picks.find((p) => p.member_code === entry.member_code);
      return {
        ...entry,
        outcome: pick ? "won" : "lost",
        pick_order: pick?.pick_order || null,
        losses_after: pick ? 0 : entry.losses + 1,
      };
    });
    for (const row of result) {
      await tx.query(
        "INSERT INTO results(drop_id,member_code,outcome,pick_order,losses_before,losses_after) VALUES($1,$2,$3,$4,$5,$6)",
        [
          id,
          row.member_code,
          row.outcome,
          row.pick_order,
          row.losses,
          row.losses_after,
        ],
      );
      await tx.query(
        "INSERT INTO pity(series_id,member_code,losses) VALUES($1,$2,$3) ON CONFLICT(series_id,member_code) DO UPDATE SET losses=EXCLUDED.losses",
        [drop.series_id, row.member_code, row.losses_after],
      );
    }
    const record = {
      version: 1,
      drop_id: id,
      algorithm: "crypto.randomInt / weighted without replacement",
      source: drop.is_setup ? "local demo setup" : "server",
      drawn_at: currentTime.toISOString(),
      items: drop.items,
      unallocated: drop.items - picks.length,
      entries: result,
      picks,
    };
    return saveRecord(tx, drop, record, currentTime);
  });
}
async function saveRecord<R extends { algorithm: string }>(
  tx: SQL,
  drop: Drop,
  record: R,
  at: Date,
  chain: { drawTx: string | null; settleTx: string | null } | null = null,
): Promise<R> {
  const record_hash = createHash("sha256")
    .update(canonicalJson(record))
    .digest("hex");
  await tx.query(
    "INSERT INTO draw_records(drop_id,algorithm,record,record_hash) VALUES($1,$2,$3,$4)",
    [drop.id, record.algorithm, JSON.stringify(record), record_hash],
  );
  if (chain)
    await tx.query(
      "UPDATE drops SET state='settled',drawn_at=$2,draw_tx=$3,settle_tx=$4 WHERE id=$1",
      [drop.id, at.toISOString(), chain.drawTx, chain.settleTx],
    );
  else
    await tx.query("UPDATE drops SET state='settled',drawn_at=$2 WHERE id=$1", [
      drop.id,
      at.toISOString(),
    ]);
  return record;
}
/** Draws and settles on Sui (only the missing steps), then mirrors the chain's result. */
async function settleFromChain(tx: SQL, drop: Drop, at: Date) {
  if (at.getTime() < new Date(drop.closes_at).getTime() + ENTRY_GRACE_MS)
    throw new AppError(
      409,
      "too_early",
      "Waiting for the last entries to reach Sui. Try the draw again in a few seconds.",
    );
  await chainLock(tx);
  const chain = await suiChain.drawAndSettleOnChain({
    dropId: drop.sui_drop_id!,
    seriesId: drop.sui_series_id!,
  });
  const { state } = chain;
  const known = new Map(
    (
      await tx.query<{ member_code: string; losses: number | null }>(
        "SELECT e.member_code,p.losses FROM entries e LEFT JOIN pity p ON p.member_code=e.member_code AND p.series_id=$2 WHERE e.drop_id=$1",
        [drop.id, drop.series_id],
      )
    ).rows.map((r) => [r.member_code, r.losses ?? 0]),
  );
  // The chain is the authority: its entries (including deposits never confirmed) and weights.
  for (const e of state.entries) await mirrorEntry(tx, drop.id, e, null);
  const outcomes = new Map(
    (chain.outcomes || []).map((o) => [Buffer.from(o.code).toString("hex"), o]),
  );
  const winners = state.winners;
  const entries = state.entries.map((e, position) => {
    const outcome = outcomes.get(e.code);
    const losses = outcome
      ? Number(outcome.losses_before)
      : (known.get(e.code) ?? 0);
    const pick = winners.indexOf(e.code) + 1;
    return {
      member_code: e.code,
      tickets: e.chances,
      losses,
      outcome: pick ? "won" : "lost",
      pick_order: pick || null,
      losses_after: pick ? 0 : losses + 1,
      position,
      paid_mist: e.paid,
      refunded_mist: pick ? "0" : e.paid,
    };
  });
  for (const row of entries) {
    await tx.query(
      "INSERT INTO results(drop_id,member_code,outcome,pick_order,losses_before,losses_after) VALUES($1,$2,$3,$4,$5,$6)",
      [
        drop.id,
        row.member_code,
        row.outcome,
        row.pick_order,
        row.losses,
        row.losses_after,
      ],
    );
    await tx.query(
      "INSERT INTO pity(series_id,member_code,losses) VALUES($1,$2,$3) ON CONFLICT(series_id,member_code) DO UPDATE SET losses=EXCLUDED.losses",
      [drop.series_id, row.member_code, row.losses_after],
    );
  }
  const unregistered = (
    await tx.query<{ member_code: string }>(
      "SELECT member_code FROM entries WHERE drop_id=$1 AND sui_status='pending' ORDER BY member_code",
      [drop.id],
    )
  ).rows.map((r) => r.member_code);
  const sum = (key: "paid_mist" | "refunded_mist", won: boolean) =>
    entries
      .filter((e) => (e.outcome === "won") === won)
      .reduce((n, e) => n + BigInt(e[key]), BigInt(0))
      .toString();
  const record = {
    version: 2,
    drop_id: drop.id,
    algorithm:
      "sui::random + tenjo::ballot::settle / weighted without replacement",
    source: `sui:${drop.sui_network}`,
    drawn_at: at.toISOString(),
    items: drop.items,
    unallocated: drop.items - winners.length,
    entries,
    // Rolls come from the Settled event, or from the recomputation when it matches the chain.
    picks: winners.map((code, i) => ({
      member_code: code,
      pick_order: i + 1,
      roll: chain.rolls?.[i] ?? (chain.verified ? chain.picks[i].roll : null),
      pool_tickets:
        chain.pools?.[i] ??
        (chain.verified ? chain.picks[i].pool_tickets : null),
    })),
    sui: {
      network: drop.sui_network,
      package_id: drop.sui_package_id,
      series_object_id: drop.sui_series_id,
      drop_object_id: drop.sui_drop_id,
      coin_type: drop.coin_type,
      price_mist: drop.price_mist,
      seed: chain.seed,
      create_tx: drop.sui_create_tx,
      draw_tx: chain.drawTx,
      settle_tx: chain.settleTx,
      verified: chain.verified,
      paid_out_mist: chain.totals?.paidOut ?? sum("paid_mist", true),
      refunded_mist: chain.totals?.refunded ?? sum("refunded_mist", false),
      payout: state.payout,
      unregistered,
    },
  };
  return saveRecord(tx, drop, record, at, chain);
}
export async function collectDrop(
  db: Database,
  id: string,
  identity: VerifiedIdentity,
) {
  return db.transaction(async (tx) => {
    const drop = await lockSeries(tx, id);
    if (drop.is_demo !== !!identity.demo)
      throw new AppError(
        403,
        "identity_mode",
        "Demo identities only work in local demo drops.",
      );
    const winner = await tx.query(
      "SELECT 1 FROM results WHERE drop_id=$1 AND member_code=$2 AND outcome='won'",
      [id, identity.code],
    );
    if (drop.state !== "settled" || !winner.rows.length)
      throw new AppError(
        403,
        "pickup_refused",
        "Pickup refused. This identity is not a winner of this drop.",
      );
    if (
      (
        await tx.query(
          "SELECT 1 FROM pickups WHERE drop_id=$1 AND member_code=$2",
          [id, identity.code],
        )
      ).rows.length
    )
      throw new AppError(
        409,
        "already_collected",
        "This item was already collected.",
      );
    await consumeChallenge(tx, identity, id, "collect");
    await tx.query(
      "INSERT INTO pickups(drop_id,member_code,presence) VALUES($1,$2,$3)",
      [id, identity.code, identity.demo ? "local-demo" : "untested-staging"],
    );
    return { code: identity.code, collected: true };
  });
}
export type AuditEntry = {
  member_code: string;
  tickets: number;
  outcome: string | null;
  pick_order: number | null;
  losses_before: number | null;
  losses_after: number | null;
  collected_at: string | null;
  /** 'pending' or 'registered' for on-chain drops; null off-chain. */
  sui_status: string | null;
  sui_tx: string | null;
  paid_mist: string;
};
/** Chain evidence for a drop, or null when it is not on Sui. Links only for real transactions. */
export function suiEvidence(drop: Drop) {
  if (!onChain(drop)) return null;
  // Links follow the network the drop was created on, and only where a public explorer exists.
  const link = (kind: "tx" | "object", id: string | null) =>
    id && explorable(drop.sui_network)
      ? suiscan(drop.sui_network!, kind, id)
      : null;
  return {
    network: drop.sui_network,
    package_id: drop.sui_package_id,
    drop_object_id: drop.sui_drop_id,
    series_object_id: drop.sui_series_id,
    coin_type: drop.coin_type,
    price_mist: drop.price_mist,
    create_tx: drop.sui_create_tx,
    draw_tx: drop.draw_tx,
    settle_tx: drop.settle_tx,
    links: {
      drop: link("object", drop.sui_drop_id),
      series: link("object", drop.sui_series_id),
      create_tx: link("tx", drop.sui_create_tx),
      draw_tx: link("tx", drop.draw_tx),
      settle_tx: link("tx", drop.settle_tx),
    },
  };
}
export async function publicDrop(db: SQL, id: string, page = 1, code = "") {
  const drop = await getDrop(db, id);
  const pattern = `%${code.toLowerCase()}%`;
  const [entries, total, record, winners] = await Promise.all([
    db.query<AuditEntry>(
      `SELECT e.member_code,e.tickets,r.outcome,r.pick_order,r.losses_before,r.losses_after,p.collected_at,e.sui_status,e.sui_tx,e.paid_mist::text AS paid_mist FROM entries e LEFT JOIN results r USING(drop_id,member_code) LEFT JOIN pickups p USING(drop_id,member_code) WHERE e.drop_id=$1 AND e.member_code LIKE $2 ORDER BY r.pick_order NULLS LAST,e.member_code LIMIT 20 OFFSET $3`,
      [id, pattern, (page - 1) * 20],
    ),
    db.query<{ total: number }>(
      "SELECT count(*)::int AS total FROM entries WHERE drop_id=$1 AND member_code LIKE $2",
      [id, pattern],
    ),
    db.query<{ record: Record<string, unknown>; record_hash: string }>(
      "SELECT record,record_hash FROM draw_records WHERE drop_id=$1",
      [id],
    ),
    db.query<{ member_code: string; pick_order: number }>(
      "SELECT member_code,pick_order FROM results WHERE drop_id=$1 AND outcome='won' ORDER BY pick_order",
      [id],
    ),
  ]);
  return {
    drop,
    entries: entries.rows,
    total: total.rows[0].total,
    page,
    record: record.rows[0] || null,
    winners: winners.rows,
    sui: suiEvidence(drop),
  };
}
export async function codeHistory(db: SQL, code: string, page = 1) {
  if (!/^[a-f0-9]{32}$/.test(code))
    throw new AppError(
      400,
      "invalid_code",
      "Enter your full 32-character anonymous code.",
    );
  const [history, pity, count] = await Promise.all([
    db.query<{
      drop_id: string;
      title: string;
      series_name: string;
      tickets: number;
      outcome: string | null;
      losses_before: number | null;
      losses_after: number | null;
      is_setup: boolean;
      created_at: string;
      sui_network: string | null;
      sui_drop_id: string | null;
      sui_status: string | null;
      drop_state: string;
      sui_tx: string | null;
      settle_tx: string | null;
    }>(
      `SELECT e.drop_id,d.title,s.name AS series_name,e.tickets,r.outcome,r.losses_before,r.losses_after,d.is_setup,e.created_at,d.sui_network,d.sui_drop_id,e.sui_status,d.state AS drop_state,e.sui_tx,d.settle_tx FROM entries e JOIN drops d ON d.id=e.drop_id JOIN series s ON s.id=d.series_id LEFT JOIN results r USING(drop_id,member_code) WHERE e.member_code=$1 ORDER BY e.created_at DESC LIMIT 20 OFFSET $2`,
      [code, (page - 1) * 20],
    ),
    db.query<{
      series_id: string;
      name: string;
      losses: number;
      sui_series_id: string | null;
    }>(
      "SELECT p.series_id,s.name,p.losses,s.sui_series_id FROM pity p JOIN series s ON s.id=p.series_id WHERE p.member_code=$1 ORDER BY s.name",
      [code],
    ),
    db.query<{ total: number }>(
      "SELECT count(*)::int AS total FROM entries WHERE member_code=$1",
      [code],
    ),
  ]);
  return {
    code,
    entries: history.rows,
    pity: pity.rows,
    total: count.rows[0].total,
    page,
  };
}
