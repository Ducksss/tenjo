import { test } from "node:test";
import assert from "node:assert/strict";
import { hashSignal } from "@worldcoin/idkit-core/hashing";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { makeDatabase, migrate, type Database } from "../src/lib/db";
import { AppError } from "../src/lib/domain";
import { createDrop, drawDrop, enterDrop } from "../src/lib/service";
import { suiChain } from "../src/lib/sui";
import { linkWallet, walletForEntry } from "../src/lib/wallet";
import { walletCode, walletLinkMessage } from "../src/lib/wallet-code";
import { issueChallenge, verifyWorldProof } from "../src/lib/world";

// The staging simulator is the primary setup; real World IDs are the second one.
process.env.WORLD_APP_ID = "app_test";
process.env.WORLD_RP_ID = "rp_test";
process.env.WORLD_ACTION = "tenjo-person";
process.env.WORLD_RP_SIGNING_KEY = "0x" + "11".repeat(32);
process.env.WORLD_ENVIRONMENT = "staging";
process.env.WORLD_PROTOCOL = "3.0";
process.env.WORLD_CREDENTIAL = "passport";
process.env.WORLD_PRODUCTION_APP_ID = "app_real";
process.env.WORLD_PRODUCTION_RP_ID = "rp_real";
process.env.WORLD_PRODUCTION_RP_SIGNING_KEY = "0x" + "22".repeat(32);

const now = Date.now();
const dropInput = (series: string, title = "Wallet drop") => ({
  title,
  series_id: series,
  series_name: "Wallet tour",
  items: 1,
  opens_at: new Date(now - 1000).toISOString(),
  closes_at: new Date(now + 60000).toISOString(),
});
async function setup() {
  const db = await makeDatabase("memory://");
  await migrate(db);
  return db;
}
/** A real World ID proof for one drop. World ID 4 gives each drop's action its own nullifier. */
async function realProof(db: Database, dropId: string, nullifier: string) {
  const challenge = await issueChallenge(db, dropId, "enter", "production");
  const raw = JSON.stringify({
    protocol_version: "4.0",
    nonce: challenge.rp_context.nonce,
    action: challenge.action,
    environment: "production",
    responses: [
      {
        identifier: "proof_of_human",
        nullifier,
        signal_hash: hashSignal(challenge.signal),
        proof: "test-placeholder",
      },
    ],
  });
  const world = (async () =>
    Response.json({
      success: true,
      environment: "production",
      action: challenge.action,
      results: [{ identifier: "proof_of_human", success: true, nullifier }],
    })) as typeof fetch;
  return {
    challenge,
    verify: () =>
      verifyWorldProof(db, raw, challenge.id, dropId, "enter", world),
  };
}
const signLink = async (
  fan: Ed25519Keypair,
  dropId: string,
  challengeId: string,
) =>
  (
    await fan.signPersonalMessage(
      new TextEncoder().encode(
        walletLinkMessage(dropId, fan.toSuiAddress(), challengeId),
      ),
    )
  ).signature;
/** What the enter route does: check the wallet first, then World ID, then enter. */
async function enterReal(
  db: Database,
  dropId: string,
  nullifier: string,
  fan?: Ed25519Keypair,
) {
  const { challenge, verify } = await realProof(db, dropId, nullifier);
  const wallet = await walletForEntry(
    db,
    dropId,
    challenge.id,
    fan?.toSuiAddress() ?? null,
    fan ? await signLink(fan, dropId, challenge.id) : null,
  );
  return enterDrop(db, dropId, linkWallet(await verify(), wallet));
}
const refusal =
  (code: string, details?: Record<string, string>) => (error: unknown) => {
    assert.ok(error instanceof AppError, String(error));
    assert.equal(error.code, code);
    if (details) assert.deepEqual(error.details, details);
    return true;
  };

test("a wallet code is stable for any spelling of the address", () => {
  const code = walletCode("0xABC");
  assert.match(code, /^[a-f0-9]{32}$/);
  assert.equal(code, walletCode(normalizeSuiAddress("0xabc")));
  assert.notEqual(code, walletCode("0xabd"));
  assert.match(
    walletLinkMessage("drop-1", "0xABC", "request-1"),
    new RegExp(`Wallet: ${normalizeSuiAddress("0xabc")}\\nRequest: request-1$`),
  );
});

test("a linked wallet carries a real World ID's losses to the next drop in the series", async () => {
  const db = await setup();
  try {
    const first = await createDrop(db, dropInput("tour"));
    const fan = Ed25519Keypair.generate();
    const withWallet = await enterReal(db, first.id, "0x1a", fan);
    assert.equal(withWallet.code, walletCode(fan.toSuiAddress()));
    assert.equal(withWallet.tickets, 1);
    assert.equal(withWallet.wallet_linked, true);
    const winner = await enterReal(db, first.id, "0x2b");
    const walletless = await enterReal(db, first.id, "0x3c");
    assert.equal(walletless.wallet_linked, undefined);
    // Each drop keeps its World ID codes beside the codes the entries use.
    assert.equal(
      (await db.query("SELECT * FROM entry_identities")).rows.length,
      3,
    );
    const pool = [withWallet.code, winner.code, walletless.code].sort();
    await drawDrop(db, first.id, new Date(now + 61000), () =>
      pool.indexOf(winner.code),
    );

    const next = await createDrop(db, dropInput("tour", "Wallet drop 2"));
    // World ID 4 gives the same person a new nullifier in every drop.
    const again = await enterReal(db, next.id, "0x1d", fan);
    assert.equal(again.code, withWallet.code);
    assert.equal(again.losses, 1);
    assert.equal(again.tickets, 2);
    const fresh = await enterReal(db, next.id, "0x3e");
    assert.equal(fresh.tickets, 1);
  } finally {
    await db.close();
  }
});

test("one person still gets one entry per drop, whichever wallet they bring", async () => {
  const db = await setup();
  try {
    const drop = await createDrop(db, dropInput("once"));
    const fan = Ed25519Keypair.generate();
    const spare = Ed25519Keypair.generate();
    const first = await enterReal(db, drop.id, "0x5", fan);
    // If World ever let the same nullifier through twice, Tenjō still refuses it.
    await assert.rejects(
      enterReal(db, drop.id, "0x5", spare),
      refusal("already_entered", { member_code: first.code }),
    );
    await assert.rejects(
      enterReal(db, drop.id, "0x5"),
      refusal("already_entered", { member_code: first.code }),
    );
    // Someone else can't enter with a wallet that already has an entry here,
    // and is told before World ID is asked, so their proof stays unspent.
    const other = await realProof(db, drop.id, "0x6");
    await assert.rejects(
      walletForEntry(
        db,
        drop.id,
        other.challenge.id,
        fan.toSuiAddress(),
        await signLink(fan, drop.id, other.challenge.id),
      ),
      refusal("wallet_in_use"),
    );
    const { rows } = await db.query<{ used_at: string | null }>(
      "SELECT used_at FROM challenges WHERE id=$1",
      [other.challenge.id],
    );
    assert.equal(rows[0].used_at, null);
    // The same refusal holds inside the entry transaction, for a race past the early check.
    await assert.rejects(
      enterDrop(
        db,
        drop.id,
        linkWallet(await other.verify(), fan.toSuiAddress()),
      ),
      refusal("wallet_in_use"),
    );
    assert.equal((await db.query("SELECT * FROM entries")).rows.length, 1);
  } finally {
    await db.close();
  }
});

test("a free entry links a wallet only with its own signature over this drop and request", async () => {
  const db = await setup();
  try {
    const drop = await createDrop(db, dropInput("signed"));
    const fan = Ed25519Keypair.generate();
    const stranger = Ed25519Keypair.generate();
    const { challenge } = await realProof(db, drop.id, "0x7");
    const { challenge: another } = await realProof(db, drop.id, "0x8");
    assert.equal(
      await walletForEntry(
        db,
        drop.id,
        challenge.id,
        fan.toSuiAddress(),
        await signLink(fan, drop.id, challenge.id),
      ),
      normalizeSuiAddress(fan.toSuiAddress()),
    );
    // A signature for another request, or from another wallet, doesn't link.
    for (const signature of [
      await signLink(fan, drop.id, another.id),
      await signLink(stranger, drop.id, challenge.id),
    ])
      await assert.rejects(
        walletForEntry(
          db,
          drop.id,
          challenge.id,
          fan.toSuiAddress(),
          signature,
        ),
        refusal("wallet_signature"),
      );
    await assert.rejects(
      walletForEntry(db, drop.id, challenge.id, fan.toSuiAddress(), null),
      refusal("wallet_signature"),
    );
    await assert.rejects(
      walletForEntry(db, drop.id, challenge.id, "0x12", "sig"),
      refusal("wallet_signature"),
    );
    // A network failure while checking a zkLogin signature is not a bad signature.
    const check = suiChain.verifyPersonalSignature;
    suiChain.verifyPersonalSignature = async () => {
      throw new Error("fullnode unreachable");
    };
    try {
      await assert.rejects(
        walletForEntry(
          db,
          drop.id,
          challenge.id,
          fan.toSuiAddress(),
          await signLink(fan, drop.id, challenge.id),
        ),
        refusal("sui_unavailable"),
      );
    } finally {
      suiChain.verifyPersonalSignature = check;
    }
    // The simulator keeps one code, so its losses already carry: a wallet changes nothing.
    const simulator = await issueChallenge(db, drop.id, "enter");
    assert.equal(
      await walletForEntry(db, drop.id, simulator.id, fan.toSuiAddress(), null),
      null,
    );
    const simulated = { code: "a".repeat(32), mode: "primary" as const };
    assert.equal(linkWallet(simulated, fan.toSuiAddress()), simulated);
  } finally {
    await db.close();
  }
});
