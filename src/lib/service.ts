import { createHash, randomUUID } from "node:crypto";
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

export const createDropSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().max(1000).default(""),
    series_id: z.string().regex(/^[a-z0-9-]{1,64}$/),
    series_name: z.string().trim().min(2).max(100),
    items: z.number().int().min(1).max(300),
    opens_at: z.iso.datetime({ offset: true }),
    closes_at: z.iso.datetime({ offset: true }),
  })
  .refine((d) => Date.parse(d.closes_at) > Date.parse(d.opens_at), {
    message: "Closing time must be after opening time.",
    path: ["closes_at"],
  });

const dropColumns = `d.*, (d.state='open' AND now()>=d.opens_at AND now()<d.closes_at) AS entry_open, s.name AS series_name, (SELECT count(*)::int FROM entries e WHERE e.drop_id=d.id) AS entry_count, (SELECT coalesce(sum(e.tickets),0)::int FROM entries e WHERE e.drop_id=d.id) AS ticket_count`;
export async function getDrop(db: SQL, id: string): Promise<Drop> {
  const { rows } = await db.query<Drop>(
    `SELECT ${dropColumns} FROM drops d JOIN series s ON s.id=d.series_id WHERE d.id=$1`,
    [id],
  );
  if (!rows[0]) throw new AppError(404, "not_found", "Drop not found.");
  return rows[0];
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
  ).rows;
}
async function lockSeries(db: SQL, dropId: string) {
  const d = await getDrop(db, dropId);
  await db.query("SELECT id FROM series WHERE id=$1 FOR UPDATE", [d.series_id]);
  await db.query("SELECT id FROM drops WHERE id=$1 FOR UPDATE", [dropId]);
  return getDrop(db, dropId);
}
export async function createDrop(
  db: Database,
  raw: unknown,
  options: { demo?: boolean; setup?: boolean; id?: string } = {},
) {
  const data = createDropSchema.parse(raw);
  return db.transaction(async (tx) => {
    await tx.query(
      "INSERT INTO series(id,name) VALUES($1,$2) ON CONFLICT DO NOTHING",
      [data.series_id, data.series_name],
    );
    await tx.query("SELECT id FROM series WHERE id=$1 FOR UPDATE", [
      data.series_id,
    ]);
    const pending = await tx.query(
      "SELECT id FROM drops WHERE series_id=$1 AND state<>'settled' LIMIT 1",
      [data.series_id],
    );
    if (pending.rows.length)
      throw new AppError(
        409,
        "series_busy",
        "Settle the current drop in this series before creating the next one.",
      );
    const id = options.id || randomUUID();
    await tx.query(
      `INSERT INTO drops(id,series_id,title,description,items,opens_at,closes_at,is_demo,is_setup) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        id,
        data.series_id,
        data.title,
        data.description,
        data.items,
        data.opens_at,
        data.closes_at,
        !!options.demo,
        !!options.setup,
      ],
    );
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
export async function enterDrop(
  db: Database,
  id: string,
  identity: VerifiedIdentity,
  now?: Date,
) {
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
    if (
      (
        await tx.query(
          "SELECT 1 FROM entries WHERE drop_id=$1 AND member_code=$2",
          [id, identity.code],
        )
      ).rows.length
    )
      throw new AppError(
        409,
        "already_entered",
        "Already entered. One person gets one entry per drop.",
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
    await tx.query(
      "INSERT INTO members(code) VALUES($1) ON CONFLICT DO NOTHING",
      [identity.code],
    );
    const tickets = ticketsFor(losses);
    await tx.query(
      "INSERT INTO entries(drop_id,member_code,tickets) VALUES($1,$2,$3)",
      [id, identity.code, tickets],
    );
    return { code: identity.code, tickets, losses, drop_id: id };
  });
}
export async function drawDrop(
  db: Database,
  id: string,
  now?: Date,
  random?: (max: number) => number,
) {
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
    const record_hash = createHash("sha256")
      .update(canonicalJson(record))
      .digest("hex");
    await tx.query(
      "INSERT INTO draw_records(drop_id,algorithm,record,record_hash) VALUES($1,$2,$3,$4)",
      [id, record.algorithm, JSON.stringify(record), record_hash],
    );
    await tx.query("UPDATE drops SET state='settled',drawn_at=$2 WHERE id=$1", [
      id,
      currentTime.toISOString(),
    ]);
    return record;
  });
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
};
export async function publicDrop(db: SQL, id: string, page = 1, code = "") {
  const drop = await getDrop(db, id);
  const pattern = `%${code.toLowerCase()}%`;
  const [entries, total, record, winners] = await Promise.all([
    db.query<AuditEntry>(
      `SELECT e.member_code,e.tickets,r.outcome,r.pick_order,r.losses_before,r.losses_after,p.collected_at FROM entries e LEFT JOIN results r USING(drop_id,member_code) LEFT JOIN pickups p USING(drop_id,member_code) WHERE e.drop_id=$1 AND e.member_code LIKE $2 ORDER BY r.pick_order NULLS LAST,e.member_code LIMIT 20 OFFSET $3`,
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
    }>(
      `SELECT e.drop_id,d.title,s.name AS series_name,e.tickets,r.outcome,r.losses_before,r.losses_after,d.is_setup,e.created_at FROM entries e JOIN drops d ON d.id=e.drop_id JOIN series s ON s.id=d.series_id LEFT JOIN results r USING(drop_id,member_code) WHERE e.member_code=$1 ORDER BY e.created_at DESC LIMIT 20 OFFSET $2`,
      [code, (page - 1) * 20],
    ),
    db.query<{ series_id: string; name: string; losses: number }>(
      "SELECT p.series_id,s.name,p.losses FROM pity p JOIN series s ON s.id=p.series_id WHERE p.member_code=$1 ORDER BY s.name",
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
