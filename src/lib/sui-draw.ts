// Pure and isomorphic: recomputes tenjo::ballot::settle from the committed seed, so anyone
// can check the chain's winners. Mirrors move/tenjo/sources/ballot.move exactly.
import { blake2b } from "@noble/hashes/blake2";
import { fromHex, normalizeSuiAddress } from "@mysten/sui/utils";

export const PERMIT_TAG = "tenjo:enter:v1";
export const MAX_EXTRA_CHANCES = 5;
export const chancesFor = (losses: number) =>
  1 + Math.min(MAX_EXTRA_CHANCES, Math.max(0, losses));

const bytes = (hex: string, length: number, label: string) => {
  const value = fromHex(hex.replace(/^0x/, ""));
  if (value.length !== length)
    throw new Error(`${label} must be ${length} bytes`);
  return value;
};
export const codeBytes = (code: string) => bytes(code, 16, "Anonymous code");
const addressBytes = (address: string) =>
  bytes(normalizeSuiAddress(address), 32, "Sui address");

/** tag (14 bytes) || drop ID (32) || code (16) || sender address (32), as ballot::permit_message. */
export function permitMessage(dropId: string, code: string, sender: string) {
  const tag = new TextEncoder().encode(PERMIT_TAG);
  const parts = [
    tag,
    addressBytes(dropId),
    codeBytes(code),
    addressBytes(sender),
  ];
  const message = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    message.set(part, offset);
    offset += part.length;
  }
  return message;
}

/** u64 little-endian from the first 8 bytes of blake2b256(seed || bcs(index as u64)). */
export function rollAt(seed: Uint8Array, index: number) {
  const data = new Uint8Array(seed.length + 8);
  data.set(seed);
  new DataView(data.buffer).setBigUint64(seed.length, BigInt(index), true);
  const digest = blake2b(data, { dkLen: 32 });
  return new DataView(digest.buffer, digest.byteOffset, 8).getBigUint64(
    0,
    true,
  );
}

export type ChainEntry = { member_code: string; tickets: number };
export type ChainPick = {
  member_code: string;
  pick_order: number;
  roll: number;
  pool_tickets: number;
};
/** Winners in pick order, from the seed and the entries in on-chain entry order. */
export function chainDraw(
  seed: string | Uint8Array,
  entries: ChainEntry[],
  items: number,
): ChainPick[] {
  const seedBytes = typeof seed === "string" ? bytes(seed, 32, "Seed") : seed;
  const picked = entries.map(() => false);
  let remaining = entries.reduce((sum, e) => sum + e.tickets, 0);
  const picks: ChainPick[] = [];
  for (let i = 0; i < Math.min(items, entries.length); i++) {
    const roll = Number(rollAt(seedBytes, i) % BigInt(remaining));
    let cursor = 0;
    const j = entries.findIndex(
      (e, index) => !picked[index] && (cursor += e.tickets) > roll,
    );
    picked[j] = true;
    picks.push({
      member_code: entries[j].member_code,
      pick_order: i + 1,
      roll,
      pool_tickets: remaining,
    });
    remaining -= entries[j].tickets;
  }
  return picks;
}
