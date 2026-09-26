import { createHash, randomInt } from "node:crypto";

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    /** Extra response fields the client can act on, such as the code a repeat entry already holds. */
    public details: Record<string, string> = {},
  ) {
    super(message);
  }
}
export const MAX_ENTRANTS = 300;
export const ticketsFor = (losses: number) =>
  1 + Math.min(5, Math.max(0, losses));
export function anonymousCode(nullifier: string, scope: string) {
  if (!/^0x[0-9a-fA-F]{1,64}$/.test(nullifier))
    throw new AppError(
      400,
      "invalid_proof",
      "World ID returned an invalid identity code.",
    );
  const canonical = BigInt(nullifier).toString(16).padStart(64, "0");
  return createHash("sha256")
    .update(`tenjo:v1:${scope}:${canonical}`)
    .digest("hex")
    .slice(0, 32);
}
export function demoCode(identity: string) {
  return createHash("sha256")
    .update(`tenjo:local-demo:${identity}`)
    .digest("hex")
    .slice(0, 32);
}
export type WeightedEntry = { member_code: string; tickets: number };
export type Pick = {
  member_code: string;
  pick_order: number;
  roll: number;
  pool_tickets: number;
};
export function weightedDraw(
  entries: WeightedEntry[],
  quantity: number,
  random: (max: number) => number = randomInt,
): Pick[] {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_ENTRANTS)
    throw new Error("Invalid draw quantity");
  if (
    entries.length > MAX_ENTRANTS ||
    new Set(entries.map((e) => e.member_code)).size !== entries.length
  )
    throw new Error("Invalid entry pool");
  const pool = entries
    .map((e) => ({ ...e }))
    .sort((a, b) => a.member_code.localeCompare(b.member_code));
  if (
    pool.some(
      (e) => !Number.isInteger(e.tickets) || e.tickets < 1 || e.tickets > 6,
    )
  )
    throw new Error("Invalid ticket weight");
  const picks: Pick[] = [];
  for (let i = 0; i < Math.min(quantity, entries.length); i++) {
    const total = pool.reduce((s, e) => s + e.tickets, 0);
    const roll = random(total);
    if (!Number.isInteger(roll) || roll < 0 || roll >= total)
      throw new Error("Invalid random sample");
    let cursor = 0;
    const selected = pool.findIndex((e) => (cursor += e.tickets) > roll);
    picks.push({
      member_code: pool[selected].member_code,
      pick_order: i + 1,
      roll,
      pool_tickets: total,
    });
    pool.splice(selected, 1);
  }
  return picks;
}
export type Drop = {
  id: string;
  series_id: string;
  series_name: string;
  title: string;
  description: string;
  items: number;
  opens_at: Date | string;
  closes_at: Date | string;
  state: string;
  is_demo: boolean;
  is_setup: boolean;
  drawn_at: Date | string | null;
  sui_drop_id: string | null;
  draw_tx: string | null;
  /** Deposit per entry in MIST, as a decimal string; "0" for a free drop. */
  price_mist: string;
  /** Deposit coin type for on-chain drops, e.g. 0x2::sui::SUI; null off-chain. */
  coin_type: string | null;
  sui_network: string | null;
  sui_series_id: string | null;
  sui_package_id: string | null;
  sui_create_tx: string | null;
  settle_tx: string | null;
  entry_count: number;
  ticket_count: number;
  entry_open: boolean;
};

/** Stable JSON representation, including after Postgres jsonb reorders object keys. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
