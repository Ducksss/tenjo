import { test } from "node:test";
import assert from "node:assert/strict";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { toHex } from "@mysten/sui/utils";
import { chainDraw, permitMessage, rollAt } from "../src/lib/sui-draw";

const code = (byte: number) => byte.toString(16).padStart(2, "0").repeat(16);
const seed = new Uint8Array(32).map((_, i) => i);

test("rolls and winners match move/tenjo/tests/ballot_tests.move", () => {
  // settle_matches_the_off_chain_vector asserts these exact u64 rolls and winners.
  assert.deepEqual(
    [0, 1, 2].map((i) => rollAt(seed, i).toString()),
    ["14226606488660556411", "953125110871885741", "10036584550145026715"],
  );
  const entries = [1, 4, 6, 2, 3].map((tickets, i) => ({
    member_code: code(i + 1),
    tickets,
  }));
  assert.deepEqual(chainDraw(seed, entries, 3), [
    { member_code: code(4), pick_order: 1, roll: 11, pool_tickets: 16 },
    { member_code: code(5), pick_order: 2, roll: 13, pool_tickets: 14 },
    { member_code: code(3), pick_order: 3, roll: 6, pool_tickets: 11 },
  ]);
  // losers_gain_a_chance_and_winners_reset: with seed 0x05 * 32 the second entry wins.
  const pair = [code(0x0a), code(0x0b)].map((member_code) => ({
    member_code,
    tickets: 1,
  }));
  assert.equal(
    chainDraw(new Uint8Array(32).fill(5), pair, 1)[0].member_code,
    code(0x0b),
  );
});

test("undersubscribed draws pick everyone once, in seed order", () => {
  const entries = [code(1), code(2)].map((member_code) => ({
    member_code,
    tickets: 3,
  }));
  const picks = chainDraw(seed, entries, 5);
  assert.equal(picks.length, 2);
  assert.deepEqual(
    new Set(picks.map((p) => p.member_code)),
    new Set([code(1), code(2)]),
  );
  assert.deepEqual(
    picks.map((p) => p.pool_tickets),
    [6, 3],
  );
  assert.deepEqual(chainDraw(seed, [], 3), []);
});

test("a localnet settle reproduces from its seed", () => {
  // tenjo::ballot::settle on a Sui localnet (sui 1.80.1, protocol 137), npm run sui:smoke.
  const entries = [
    "f5edd6c9d406c937d6422db500fc1048",
    "d04376e52d6b3da346a560e4e8b8dd94",
    "76d8780d99148207783db9ce757e5d56",
  ].map((member_code) => ({ member_code, tickets: 1 }));
  const picks = chainDraw(
    "f33ff0401f81663ff7eea4f4361a45a02f670d1fd0f243cdecffaea5d1a3796b",
    entries,
    1,
  );
  assert.equal(picks[0].member_code, "76d8780d99148207783db9ce757e5d56");
});

test("permit bytes are tag || drop || code || sender and sign like the Move vectors", async () => {
  const drop =
    "0x1611edd9a9d42dbcd9ae773ffa22be0f6017b00590959dd5c767e4efcd34cd0b";
  const message = permitMessage(drop, code(0xa1), "0xfa");
  assert.equal(message.length, 14 + 32 + 16 + 32);
  assert.equal(
    new TextDecoder().decode(message.slice(0, 14)),
    "tenjo:enter:v1",
  );
  assert.equal(toHex(message.slice(14, 46)), drop.slice(2));
  assert.equal(toHex(message.slice(46, 62)), code(0xa1));
  assert.equal(toHex(message.slice(62)), "fa".padStart(64, "0"));
  // ballot_tests.move PERMIT_A, verified on-chain by ed25519_verify in the Move tests.
  const registrar = Ed25519Keypair.fromSecretKey(new Uint8Array(32).fill(7));
  assert.equal(
    toHex(await registrar.sign(message)),
    "87d972fb34eb9e9a72636e4d355ce92e80fd787b039e68ac161f3dc34b58def861a5fb49439cdd38bbfd923f24d323bbc68b4f86be3276a086c2db36df3f4b0e",
  );
  assert.throws(() => permitMessage(drop, "abcd", "0xfa"), /16 bytes/);
});
