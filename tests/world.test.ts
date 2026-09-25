import { test } from "node:test";
import assert from "node:assert/strict";
import { hashSignal } from "@worldcoin/idkit-core/hashing";
import { makeDatabase, migrate } from "../src/lib/db";
import { createDrop, enterDrop } from "../src/lib/service";
import { issueChallenge, verifyWorldProof } from "../src/lib/world";

process.env.WORLD_APP_ID = "app_test";
process.env.WORLD_RP_ID = "rp_test";
process.env.WORLD_ACTION = "tenjo-person";
process.env.WORLD_RP_SIGNING_KEY = "0x" + "11".repeat(32);
process.env.WORLD_ENVIRONMENT = "staging";
process.env.WORLD_PROTOCOL = "3.0";
process.env.WORLD_CREDENTIAL = "passport";
const success = {
  success: true,
  environment: "staging",
  action: "tenjo-person",
  results: [{ identifier: "document", success: true, nullifier: "0x01" }],
};
const ok = (body: unknown = success) =>
  (async () => Response.json(body)) as typeof fetch;

test("server verifies exact bytes, binds purpose and nonce, refuses tampering and replay", async () => {
  const db = await makeDatabase("memory://");
  await migrate(db);
  try {
    const now = Date.now();
    const drop = await createDrop(db, {
      title: "Verified drop",
      series_id: "world",
      series_name: "World test",
      items: 1,
      opens_at: new Date(now - 1000).toISOString(),
      closes_at: new Date(now + 600000).toISOString(),
    });
    const challenge = await issueChallenge(db, drop.id, "enter");
    const body = {
      protocol_version: "3.0",
      nonce: challenge.rp_context.nonce,
      action: challenge.action,
      environment: "staging",
      responses: [
        {
          identifier: "document",
          nullifier: "0x1",
          signal_hash: hashSignal(challenge.signal),
          proof: "test-placeholder",
          merkle_root: "0x00",
        },
      ],
    };
    const raw = JSON.stringify(body, null, 2) + "\n";
    let forwarded = "";
    const fetcher = (async (_url, init) => {
      forwarded = String(init!.body);
      return Response.json(success);
    }) as typeof fetch;
    const identity = await verifyWorldProof(
      db,
      raw,
      challenge.id,
      drop.id,
      "enter",
      fetcher,
    );
    assert.equal(forwarded, raw);
    assert.equal((await db.query("SELECT * FROM entries")).rows.length, 0);
    await assert.rejects(
      verifyWorldProof(db, raw, challenge.id, drop.id, "collect", ok()),
      /expired|another/,
    );
    const altered = JSON.stringify({
      ...body,
      responses: [
        { ...body.responses[0], signal_hash: hashSignal("enter:another") },
      ],
    });
    await assert.rejects(
      verifyWorldProof(db, altered, challenge.id, drop.id, "enter", ok()),
      /signal/,
    );
    await assert.rejects(
      verifyWorldProof(
        db,
        raw,
        challenge.id,
        drop.id,
        "enter",
        ok({ ...success, environment: "production" }),
      ),
      /did not verify/,
    );
    await assert.rejects(
      verifyWorldProof(
        db,
        raw,
        challenge.id,
        drop.id,
        "enter",
        ok({
          ...success,
          results: [
            { identifier: "selfie", success: true, nullifier: "0x01" },
            { identifier: "document", success: false },
          ],
        }),
      ),
      /did not verify/,
    );
    await assert.rejects(
      verifyWorldProof(
        db,
        raw,
        challenge.id,
        drop.id,
        "enter",
        (async () => new Response("", { status: 503 })) as typeof fetch,
      ),
      /unavailable/,
    );
    assert.equal((await db.query("SELECT * FROM entries")).rows.length, 0);
    await enterDrop(db, drop.id, identity);
    process.env.WORLD_PROTOCOL = "4.0";
    await assert.rejects(
      verifyWorldProof(db, raw, challenge.id, drop.id, "enter", ok()),
      /settings changed/,
    );
    process.env.WORLD_PROTOCOL = "3.0";
    await assert.rejects(
      verifyWorldProof(db, raw, challenge.id, drop.id, "enter", ok()),
      /expired/,
    );
    const second = await issueChallenge(db, drop.id, "enter");
    const secondBody = JSON.stringify({
      ...body,
      nonce: second.rp_context.nonce,
      responses: [
        { ...body.responses[0], signal_hash: hashSignal(second.signal) },
      ],
    });
    const same = await verifyWorldProof(
      db,
      secondBody,
      second.id,
      drop.id,
      "enter",
      ok(),
    );
    assert.equal(same.code, identity.code);
    await assert.rejects(enterDrop(db, drop.id, same), /Already entered/);
    assert.equal((await db.query("SELECT * FROM entries")).rows.length, 1);
    process.env.WORLD_PROTOCOL = "4.0";
    await assert.rejects(
      verifyWorldProof(db, raw, challenge.id, drop.id, "enter", ok()),
      /settings changed/,
    );
    process.env.WORLD_PROTOCOL = "3.0";
    const logs = (
      await db.query<{ outcome: string }>("SELECT outcome FROM proof_log")
    ).rows;
    assert.ok(logs.some((l) => l.outcome === "unavailable"));
    assert.ok(logs.some((l) => l.outcome === "verified"));
  } finally {
    await db.close();
  }
});
test("missing config and unvalidated pickup fail closed", async () => {
  const db = await makeDatabase("memory://");
  await migrate(db);
  try {
    const key = process.env.WORLD_RP_SIGNING_KEY;
    delete process.env.WORLD_RP_SIGNING_KEY;
    await assert.rejects(
      verifyWorldProof(db, "{}", "x", "x", "enter", ok()),
      /not configured/,
    );
    process.env.WORLD_RP_SIGNING_KEY = key;
    assert.equal((await db.query("SELECT * FROM members")).rows.length, 0);
  } finally {
    await db.close();
  }
});
