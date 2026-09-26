import {
  createHash,
  generateKeyPairSync,
  randomBytes,
  sign,
} from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { hashSignal } from "@worldcoin/idkit-core/hashing";
import { makeDatabase, migrate, type Database } from "../src/lib/db";
import { AppError } from "../src/lib/domain";
import {
  linkPasskey,
  passkeyForEntry,
  registerPasskey,
} from "../src/lib/passkey";
import { passkeyChallenge, passkeyCode } from "../src/lib/passkey-code";
import { createDrop, drawDrop, enterDrop } from "../src/lib/service";
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
delete process.env.APP_ORIGIN;

const ORIGIN = "http://localhost:3000";
const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url");
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest();
/** The CBOR WebAuthn needs: maps, text, byte strings and small integers. */
function cbor(value: unknown): Buffer {
  const head = (major: number, n: number) =>
    n < 24
      ? Buffer.from([(major << 5) | n])
      : n < 256
        ? Buffer.from([(major << 5) | 24, n])
        : Buffer.from([(major << 5) | 25, n >> 8, n & 255]);
  if (typeof value === "number")
    return value >= 0 ? head(0, value) : head(1, -1 - value);
  if (typeof value === "string") {
    const bytes = Buffer.from(value);
    return Buffer.concat([head(3, bytes.length), bytes]);
  }
  if (value instanceof Uint8Array)
    return Buffer.concat([head(2, value.length), value]);
  if (value instanceof Map)
    return Buffer.concat([
      head(5, value.size),
      ...[...value].flatMap(([k, v]) => [cbor(k), cbor(v)]),
    ]);
  throw new Error("unsupported CBOR value");
}
/** A software passkey: a real Ed25519 key answering WebAuthn create and get like a phone would. */
class Passkey {
  keys = generateKeyPairSync("ed25519");
  constructor(
    public id = b64(randomBytes(16)),
    public rpId = "localhost",
  ) {}
  #authData(attested: boolean) {
    const count = Buffer.alloc(4);
    const parts: Buffer[] = [
      sha(Buffer.from(this.rpId)),
      Buffer.from([attested ? 0x41 : 0x01]),
      count,
    ];
    if (attested) {
      const raw = Buffer.from(this.id, "base64url");
      const length = Buffer.alloc(2);
      length.writeUInt16BE(raw.length);
      const x = Buffer.from(
        this.keys.publicKey.export({ format: "jwk" }).x!,
        "base64url",
      );
      parts.push(
        Buffer.alloc(16),
        length,
        raw,
        cbor(
          new Map<number, unknown>([
            [1, 1],
            [3, -8],
            [-1, 6],
            [-2, x],
          ]),
        ),
      );
    }
    return Buffer.concat(parts);
  }
  #clientData(type: string, challenge: string, origin: string) {
    return Buffer.from(
      JSON.stringify({ type, challenge, origin, crossOrigin: false }),
    );
  }
  create(challenge: string, origin = ORIGIN) {
    const attestationObject = cbor(
      new Map<string, unknown>([
        ["fmt", "none"],
        ["attStmt", new Map()],
        ["authData", this.#authData(true)],
      ]),
    );
    return {
      id: this.id,
      rawId: this.id,
      type: "public-key",
      response: {
        clientDataJSON: b64(
          this.#clientData("webauthn.create", challenge, origin),
        ),
        attestationObject: b64(attestationObject),
        transports: ["internal"],
      },
      clientExtensionResults: {},
    };
  }
  get(challenge: string, origin = ORIGIN) {
    const authenticatorData = this.#authData(false);
    const clientDataJSON = this.#clientData("webauthn.get", challenge, origin);
    const signature = sign(
      null,
      Buffer.concat([authenticatorData, sha(clientDataJSON)]),
      this.keys.privateKey,
    );
    return {
      id: this.id,
      rawId: this.id,
      type: "public-key",
      response: {
        clientDataJSON: b64(clientDataJSON),
        authenticatorData: b64(authenticatorData),
        signature: b64(signature),
      },
      clientExtensionResults: {},
    };
  }
}

const now = Date.now();
const dropInput = (series: string, title = "Passkey drop") => ({
  title,
  series_id: series,
  series_name: "Passkey tour",
  items: 1,
  opens_at: new Date(now - 1000).toISOString(),
  closes_at: new Date(now + 60000).toISOString(),
});
async function setup() {
  const db = await makeDatabase("memory://");
  await migrate(db);
  return db;
}
const request = (passkeyHeader?: string) =>
  new Request(`${ORIGIN}/api/drops/x/enter`, {
    method: "POST",
    headers: passkeyHeader ? { "x-tenjo-passkey": passkeyHeader } : {},
  });
const proofHeader = (proof: object) =>
  Buffer.from(JSON.stringify(proof)).toString("base64url");
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
const register = (
  db: Database,
  key: Passkey,
  dropId: string,
  challengeId: string,
) =>
  registerPasskey(db, request(), {
    drop_id: dropId,
    challenge_id: challengeId,
    response: key.create(passkeyChallenge("create", dropId, challengeId)),
  });
/** What the browser and the enter route do together: passkey first, then World ID, then entry. */
async function enterReal(
  db: Database,
  dropId: string,
  nullifier: string,
  key?: Passkey,
  how: "create" | "get" = "get",
) {
  const { challenge, verify } = await realProof(db, dropId, nullifier);
  let header: string | undefined;
  if (key && how === "create") {
    await register(db, key, dropId, challenge.id);
    header = proofHeader({ created: key.id });
  } else if (key)
    header = proofHeader({
      assertion: key.get(passkeyChallenge("get", dropId, challenge.id)),
    });
  const passkey = await passkeyForEntry(
    db,
    request(header),
    dropId,
    challenge.id,
  );
  return enterDrop(db, dropId, linkPasskey(await verify(), passkey));
}
const refusal =
  (code: string, details?: Record<string, string>) => (error: unknown) => {
    assert.ok(error instanceof AppError, String(error));
    assert.equal(error.code, code);
    if (details) assert.deepEqual(error.details, details);
    return true;
  };

test("a passkey code is stable, and each challenge names its drop and request", () => {
  const code = passkeyCode("credential-1");
  assert.match(code, /^[a-f0-9]{32}$/);
  assert.equal(code, passkeyCode("credential-1"));
  assert.notEqual(code, passkeyCode("credential-2"));
  const created = passkeyChallenge("create", "drop", "request");
  assert.match(created, /^[A-Za-z0-9_-]{43}$/);
  for (const other of [
    passkeyChallenge("get", "drop", "request"),
    passkeyChallenge("create", "drop", "another"),
    passkeyChallenge("create", "other-drop", "request"),
  ])
    assert.notEqual(created, other);
});

test("a passkey carries a real World ID's losses to the next drop in the series", async () => {
  const db = await setup();
  try {
    const first = await createDrop(db, dropInput("tour"));
    const key = new Passkey();
    // Creating the passkey is the first entry's proof: one prompt.
    const withPasskey = await enterReal(db, first.id, "0x1a", key, "create");
    assert.equal(withPasskey.code, passkeyCode(key.id));
    assert.equal(withPasskey.tickets, 1);
    assert.equal(withPasskey.passkey_linked, true);
    const winner = await enterReal(db, first.id, "0x2b");
    const without = await enterReal(db, first.id, "0x3c");
    assert.equal(without.passkey_linked, undefined);
    // Tenjō keeps the passkey's public key, and each drop's World ID code beside the entry code.
    assert.equal((await db.query("SELECT * FROM passkeys")).rows.length, 1);
    assert.equal(
      (await db.query("SELECT * FROM entry_identities")).rows.length,
      3,
    );
    const pool = [withPasskey.code, winner.code, without.code].sort();
    await drawDrop(db, first.id, new Date(now + 61000), () =>
      pool.indexOf(winner.code),
    );

    const next = await createDrop(db, dropInput("tour", "Passkey drop 2"));
    // World ID 4 gives the same person a new nullifier; the passkey signs this entry.
    const again = await enterReal(db, next.id, "0x1d", key);
    assert.equal(again.code, withPasskey.code);
    assert.equal(again.losses, 1);
    assert.equal(again.tickets, 2);
    const fresh = await enterReal(db, next.id, "0x3e");
    assert.equal(fresh.tickets, 1);
  } finally {
    await db.close();
  }
});

test("one person still gets one entry per drop, whichever passkey they bring", async () => {
  const db = await setup();
  try {
    const drop = await createDrop(db, dropInput("once"));
    const key = new Passkey();
    const first = await enterReal(db, drop.id, "0x5", key, "create");
    // If World ever let the same nullifier through twice, Tenjō still refuses it.
    await assert.rejects(
      enterReal(db, drop.id, "0x5", new Passkey(), "create"),
      refusal("already_entered", { member_code: first.code }),
    );
    await assert.rejects(
      enterReal(db, drop.id, "0x5"),
      refusal("already_entered", { member_code: first.code }),
    );
    // Someone else can't enter with a passkey that already has an entry here, and is
    // told before World ID is asked, so their proof stays unspent.
    const other = await realProof(db, drop.id, "0x6");
    const shared = proofHeader({
      assertion: key.get(passkeyChallenge("get", drop.id, other.challenge.id)),
    });
    await assert.rejects(
      passkeyForEntry(db, request(shared), drop.id, other.challenge.id),
      refusal("passkey_in_use"),
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
        linkPasskey(await other.verify(), {
          code: first.code,
          credentialId: key.id,
        }),
      ),
      refusal("passkey_in_use"),
    );
    assert.equal((await db.query("SELECT * FROM entries")).rows.length, 1);
  } finally {
    await db.close();
  }
});

test("a passkey links only with its own signature over this drop and request", async () => {
  const db = await setup();
  try {
    const drop = await createDrop(db, dropInput("signed"));
    const key = new Passkey();
    const { challenge } = await realProof(db, drop.id, "0x7");
    const { challenge: another } = await realProof(db, drop.id, "0x8");
    // Registration answers this request's challenge, from this site.
    await assert.rejects(
      registerPasskey(db, request(), {
        drop_id: drop.id,
        challenge_id: challenge.id,
        response: key.create(passkeyChallenge("create", drop.id, another.id)),
      }),
      refusal("passkey_invalid"),
    );
    await assert.rejects(
      registerPasskey(db, request(), {
        drop_id: drop.id,
        challenge_id: challenge.id,
        response: key.create(
          passkeyChallenge("create", drop.id, challenge.id),
          "https://elsewhere.example",
        ),
      }),
      refusal("passkey_invalid"),
    );
    assert.deepEqual(await register(db, key, drop.id, challenge.id), {
      code: passkeyCode(key.id),
    });
    // The same credential ID can't be taken over by another key.
    await assert.rejects(
      register(db, new Passkey(key.id), drop.id, challenge.id),
      refusal("passkey_taken"),
    );
    const check = (header: string, challengeId: string = challenge.id) =>
      passkeyForEntry(db, request(header), drop.id, challengeId);
    const signed = (by: Passkey, challengeId: string, origin?: string) =>
      proofHeader({
        assertion: by.get(
          passkeyChallenge("get", drop.id, challengeId),
          origin,
        ),
      });
    assert.deepEqual(await check(signed(key, challenge.id)), {
      code: passkeyCode(key.id),
      credentialId: key.id,
    });
    assert.deepEqual(await check(proofHeader({ created: key.id })), {
      code: passkeyCode(key.id),
      credentialId: key.id,
    });
    const refused: [string, string, string?][] = [
      // A signature for another request, from another site, or by another key doesn't link.
      [signed(key, another.id), "passkey_invalid"],
      [
        signed(key, challenge.id, "https://elsewhere.example"),
        "passkey_invalid",
      ],
      [signed(new Passkey(key.id), challenge.id), "passkey_invalid"],
      // Creating it counted only for the request it was created in.
      [proofHeader({ created: key.id }), "passkey_invalid", another.id],
      [signed(new Passkey(), challenge.id), "passkey_unknown"],
      ["not base64 json", "passkey_invalid"],
    ];
    for (const [header, code, challengeId] of refused)
      await assert.rejects(check(header, challengeId), refusal(code));
    // The simulator keeps one code, so its losses already carry: no passkey links or registers.
    const simulator = await issueChallenge(db, drop.id, "enter");
    assert.equal(await check(signed(key, simulator.id), simulator.id), null);
    await assert.rejects(
      register(db, new Passkey(), drop.id, simulator.id),
      refusal("passkey_request"),
    );
    const simulated = { code: "a".repeat(32), mode: "primary" as const };
    assert.equal(
      linkPasskey(simulated, { code: "b".repeat(32), credentialId: key.id }),
      simulated,
    );
  } finally {
    await db.close();
  }
});
