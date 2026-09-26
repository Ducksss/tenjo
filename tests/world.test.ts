import { test } from "node:test";
import assert from "node:assert/strict";
import { hashSignal } from "@worldcoin/idkit-core/hashing";
import { makeDatabase, migrate } from "../src/lib/db";
import { AppError } from "../src/lib/domain";
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
    // A repeat is refused on its own terms, carrying the person's own code back to them.
    await assert.rejects(
      enterDrop(db, drop.id, same),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === "already_entered" &&
        /Already entered/.test(error.message) &&
        error.details.member_code === identity.code,
    );
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
test("staging verification carries the window token and reports a closed window", async () => {
  const db = await makeDatabase("memory://");
  await migrate(db);
  try {
    const now = Date.now();
    const drop = await createDrop(db, {
      title: "Staging window",
      series_id: "window",
      series_name: "Window test",
      items: 1,
      opens_at: new Date(now - 1000).toISOString(),
      closes_at: new Date(now + 600000).toISOString(),
    });
    const proof = async () => {
      const challenge = await issueChallenge(db, drop.id, "enter");
      const raw = JSON.stringify({
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
      });
      return { raw, id: challenge.id };
    };
    let sent: string | null = null;
    const capture = (async (_url, init) => {
      sent = new Headers(init!.headers).get("x-staging-verification-token");
      return Response.json(success);
    }) as typeof fetch;
    process.env.WORLD_STAGING_VERIFICATION_TOKEN = "stg_test";
    const open = await proof();
    await verifyWorldProof(db, open.raw, open.id, drop.id, "enter", capture);
    assert.equal(sent, "stg_test");
    const closed = await proof();
    await assert.rejects(
      verifyWorldProof(db, closed.raw, closed.id, drop.id, "enter", (async () =>
        Response.json(
          { code: "environment_not_allowed" },
          { status: 403 },
        )) as typeof fetch),
      /staging verification window is closed/,
    );
    delete process.env.WORLD_STAGING_VERIFICATION_TOKEN;
    const none = await proof();
    await verifyWorldProof(db, none.raw, none.id, drop.id, "enter", capture);
    assert.equal(sent, null);
  } finally {
    delete process.env.WORLD_STAGING_VERIFICATION_TOKEN;
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
test("real World IDs enter beside the staging simulator, each checked against its own setup", async () => {
  const db = await makeDatabase("memory://");
  await migrate(db);
  process.env.WORLD_PRODUCTION_APP_ID = "app_real";
  process.env.WORLD_PRODUCTION_RP_ID = "rp_real";
  process.env.WORLD_PRODUCTION_RP_SIGNING_KEY = "0x" + "22".repeat(32);
  try {
    const now = Date.now();
    const drop = await createDrop(db, {
      title: "Both kinds of World ID",
      series_id: "both",
      series_name: "Both test",
      items: 1,
      opens_at: new Date(now - 1000).toISOString(),
      closes_at: new Date(now + 600000).toISOString(),
    });
    const real = await issueChallenge(db, drop.id, "enter", "production");
    assert.equal(real.environment, "production");
    assert.equal(real.app_id, "app_real");
    const proof = (identifier: string) =>
      JSON.stringify({
        protocol_version: "4.0",
        nonce: real.rp_context.nonce,
        action: real.action,
        environment: "production",
        responses: [
          {
            identifier,
            nullifier: "0x1",
            signal_hash: hashSignal(real.signal),
            proof: "test-placeholder",
          },
        ],
      });
    const humanOk = ok({
      success: true,
      environment: "production",
      action: real.action,
      results: [
        { identifier: "proof_of_human", success: true, nullifier: "0x01" },
      ],
    });
    let url = "";
    const capture = (async (target, init) => {
      url = String(target);
      return humanOk(target, init);
    }) as typeof fetch;
    // The Orb's Proof of Human is the real-ID credential; a passport answer is refused.
    await assert.rejects(
      verifyWorldProof(
        db,
        proof("passport"),
        real.id,
        drop.id,
        "enter",
        humanOk,
      ),
      /credential/,
    );
    const person = await verifyWorldProof(
      db,
      proof("proof_of_human"),
      real.id,
      drop.id,
      "enter",
      capture,
    );
    assert.equal(person.mode, "production");
    assert.match(url, /\/verify\/rp_real$/);
    await enterDrop(db, drop.id, person);
    // The simulator still works on the primary staging setup, with its own lock.
    const sim = await issueChallenge(db, drop.id, "enter");
    const simProof = JSON.stringify({
      protocol_version: "3.0",
      nonce: sim.rp_context.nonce,
      action: sim.action,
      environment: "staging",
      responses: [
        {
          identifier: "document",
          nullifier: "0x1",
          signal_hash: hashSignal(sim.signal),
          proof: "test-placeholder",
          merkle_root: "0x00",
        },
      ],
    });
    const simulated = await verifyWorldProof(
      db,
      simProof,
      sim.id,
      drop.id,
      "enter",
      ok(),
    );
    assert.equal(simulated.mode, "primary");
    assert.notEqual(simulated.code, person.code);
    await enterDrop(db, drop.id, simulated);
    assert.equal((await db.query("SELECT * FROM entries")).rows.length, 2);
    assert.equal(
      (await db.query("SELECT * FROM identity_policy_modes")).rows.length,
      1,
    );
  } finally {
    delete process.env.WORLD_PRODUCTION_APP_ID;
    delete process.env.WORLD_PRODUCTION_RP_ID;
    delete process.env.WORLD_PRODUCTION_RP_SIGNING_KEY;
    await db.close();
  }
});
test("without real World IDs configured, a database not yet migrated for them still admits the simulator", async () => {
  const db = await makeDatabase("memory://");
  await migrate(db);
  await db.query("ALTER TABLE challenges DROP COLUMN mode");
  await db.query("DROP TABLE identity_policy_modes");
  try {
    const now = Date.now();
    const drop = await createDrop(db, {
      title: "Before migration",
      series_id: "premigration",
      series_name: "Premigration test",
      items: 1,
      opens_at: new Date(now - 1000).toISOString(),
      closes_at: new Date(now + 600000).toISOString(),
    });
    const challenge = await issueChallenge(db, drop.id, "enter");
    const raw = JSON.stringify({
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
    });
    const identity = await verifyWorldProof(
      db,
      raw,
      challenge.id,
      drop.id,
      "enter",
      ok(),
    );
    await enterDrop(db, drop.id, identity);
    assert.equal((await db.query("SELECT * FROM entries")).rows.length, 1);
  } finally {
    await db.close();
  }
});
