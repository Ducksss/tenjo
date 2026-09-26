// Prints the hardcoded vectors in move/tenjo/tests/ballot_tests.move and tests/sui-draw.test.ts.
// The registrar seed is a fixed, test-only value; it never signs anything on a network.
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { toHex } from "@mysten/sui/utils";
import { chainDraw, permitMessage, rollAt } from "../src/lib/sui-draw";

const registrar = Ed25519Keypair.fromSecretKey(new Uint8Array(32).fill(7));
// ID of the first drop in every ballot_tests scenario (printed by a probe test).
const drop =
  "0x1611edd9a9d42dbcd9ae773ffa22be0f6017b00590959dd5c767e4efcd34cd0b";
const code = (byte: number) => byte.toString(16).padStart(2, "0").repeat(16);
console.log(`REGISTRAR = x"${toHex(registrar.getPublicKey().toRawBytes())}"`);
for (const [name, fan, byte] of [
  ["A", "0xfa", 0xa1],
  ["B", "0xfb", 0xb2],
  ["C", "0xfc", 0xc3],
] as const) {
  const signature = await registrar.sign(permitMessage(drop, code(byte), fan));
  console.log(`PERMIT_${name} = x"${toHex(signature)}"`);
}
const seed = new Uint8Array(32).map((_, i) => i);
console.log(`SEED = x"${toHex(seed)}"`);
console.log(
  "rolls",
  [0, 1, 2].map((i) => rollAt(seed, i).toString()),
);
const entries = [
  [0x01, 1],
  [0x02, 4],
  [0x03, 6],
  [0x04, 2],
  [0x05, 3],
].map(([byte, tickets]) => ({ member_code: code(byte), tickets }));
console.log(JSON.stringify(chainDraw(seed, entries, 3)));
const pair = [code(0x0a), code(0x0b)].map((member_code) => ({
  member_code,
  tickets: 1,
}));
for (let b = 0; b < 8; b++) {
  const s = new Uint8Array(32).fill(b);
  console.log(
    `pair seed ${b}:`,
    chainDraw(s, pair, 1)[0].member_code.slice(0, 2),
  );
}
