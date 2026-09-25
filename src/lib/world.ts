import { createHash, randomUUID } from "node:crypto";
import { signRequest } from "@worldcoin/idkit-core/signing";
import { hashSignal } from "@worldcoin/idkit-core/hashing";
import { z } from "zod";
import type { SQL } from "./db";
import { anonymousCode, AppError } from "./domain";
import { getDrop, type VerifiedIdentity } from "./service";

export function worldConfig() {
  const environment =
    process.env.WORLD_ENVIRONMENT === "production"
      ? ("production" as const)
      : ("staging" as const);
  const protocol =
    environment === "production"
      ? "4.0"
      : process.env.WORLD_PROTOCOL === "4.0"
        ? "4.0"
        : "3.0";
  const credential =
    process.env.WORLD_CREDENTIAL === "orb"
      ? ("orb" as const)
      : ("passport" as const);
  return {
    app_id: process.env.WORLD_APP_ID || "",
    rp_id: process.env.WORLD_RP_ID || "",
    action: process.env.WORLD_ACTION || "tenjo-person",
    environment,
    protocol,
    credential,
    ready: !!(
      process.env.WORLD_APP_ID &&
      process.env.WORLD_RP_ID &&
      process.env.WORLD_RP_SIGNING_KEY
    ),
    // Production pickup remains disabled until World confirms server-enforced liveness.
    pickupAllowed:
      environment === "staging" &&
      process.env.WORLD_ALLOW_UNTESTED_PICKUP === "true",
  };
}
function requireConfig() {
  const config = worldConfig();
  if (!config.ready)
    throw new AppError(
      503,
      "world_not_configured",
      "World ID is not configured yet. The organiser must add the staging app, RP ID and signing key.",
    );
  return config;
}
export async function issueChallenge(
  db: SQL,
  dropId: string,
  purpose: "enter" | "collect",
) {
  const config = requireConfig();
  const drop = await getDrop(db, dropId);
  if (drop.is_demo)
    throw new AppError(
      400,
      "local_demo",
      "Use the labelled local demo controls for this drop.",
    );
  if (
    purpose === "enter" &&
    (drop.state !== "open" ||
      Date.now() < new Date(drop.opens_at).getTime() ||
      Date.now() >= new Date(drop.closes_at).getTime())
  )
    throw new AppError(
      409,
      "entry_closed",
      "Entries are not open for this drop.",
    );
  if (purpose === "collect" && !config.pickupAllowed)
    throw new AppError(
      503,
      "presence_unvalidated",
      "Pickup is disabled until server-side liveness is validated. The staging fallback can be enabled explicitly.",
    );
  if (purpose === "collect" && drop.state !== "settled")
    throw new AppError(
      409,
      "not_drawn",
      "Wait until the draw is settled before collecting.",
    );
  const signed = signRequest({
    signingKeyHex: process.env.WORLD_RP_SIGNING_KEY!,
    action: config.action,
    ttl: 300,
  });
  const id = randomUUID();
  await db.query("DELETE FROM challenges WHERE expires_at < now()");
  await db.query(
    "INSERT INTO challenges(id,nonce,drop_id,purpose,expires_at) VALUES($1,$2,$3,$4,$5)",
    [
      id,
      signed.nonce,
      dropId,
      purpose,
      new Date(signed.expiresAt * 1000).toISOString(),
    ],
  );
  return {
    id,
    app_id: config.app_id,
    action: config.action,
    environment: config.environment,
    credential: config.credential,
    protocol: config.protocol,
    signal: `${purpose}:${dropId}:${id}`,
    require_user_presence: purpose === "collect",
    rp_context: {
      rp_id: config.rp_id,
      nonce: signed.nonce,
      created_at: signed.createdAt,
      expires_at: signed.expiresAt,
      signature: signed.sig,
    },
  };
}
const itemSchema = z
  .object({
    identifier: z.string(),
    nullifier: z.string(),
    signal_hash: z.string(),
  })
  .passthrough();
const proofSchema = z
  .object({
    protocol_version: z.enum(["3.0", "4.0"]),
    nonce: z.string(),
    action: z.string(),
    environment: z.string(),
    responses: z.array(itemSchema).min(1).max(5),
    user_presence_completed: z.boolean().optional(),
  })
  .passthrough();
const verifySchema = z
  .object({
    success: z.literal(true),
    environment: z.string(),
    action: z.string(),
    results: z
      .array(
        z.object({
          identifier: z.string(),
          success: z.boolean(),
          nullifier: z.string().optional(),
        }),
      )
      .min(1),
  })
  .passthrough();
function sameInteger(a: string, b: string) {
  try {
    return (
      /^0x[0-9a-fA-F]+$/.test(a) &&
      /^0x[0-9a-fA-F]+$/.test(b) &&
      BigInt(a) === BigInt(b)
    );
  } catch {
    return false;
  }
}

export async function verifyWorldProof(
  db: SQL,
  rawBody: string,
  challengeId: string,
  dropId: string,
  purpose: "enter" | "collect",
  fetcher: typeof fetch = fetch,
): Promise<VerifiedIdentity> {
  const start = performance.now();
  let outcome = "rejected";
  try {
    const config = requireConfig();
    const policy = createHash("sha256")
      .update(
        JSON.stringify([
          config.app_id,
          config.rp_id,
          config.action,
          config.environment,
          config.protocol,
          config.credential,
        ]),
      )
      .digest("hex");
    const registeredPolicy = (
      await db.query<{ fingerprint: string }>(
        "SELECT fingerprint FROM identity_policy WHERE singleton=true",
      )
    ).rows[0];
    if (registeredPolicy && registeredPolicy.fingerprint !== policy)
      throw new AppError(
        503,
        "identity_policy",
        "World identity settings changed after entries were accepted. Restore the original settings or use a new database.",
      );
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      throw new AppError(
        400,
        "invalid_proof",
        "Invalid World ID response. Verify again.",
      );
    }
    const proofResult = proofSchema.safeParse(parsed);
    if (!proofResult.success)
      throw new AppError(
        400,
        "invalid_proof",
        "Incomplete World ID response. Verify again.",
      );
    const proof = proofResult.data;
    if (
      proof.environment !== config.environment ||
      proof.action !== config.action ||
      proof.protocol_version !== config.protocol
    )
      throw new AppError(
        400,
        "proof_context",
        "The verification does not match this app, environment or protocol.",
      );
    const challenge = (
      await db.query<{
        nonce: string;
        expires_at: string;
        used_at: string | null;
      }>(
        "SELECT nonce,expires_at,used_at FROM challenges WHERE id=$1 AND drop_id=$2 AND purpose=$3",
        [challengeId, dropId, purpose],
      )
    ).rows[0];
    if (
      !challenge ||
      challenge.used_at ||
      new Date(challenge.expires_at).getTime() <= Date.now() ||
      !sameInteger(challenge.nonce, proof.nonce)
    )
      throw new AppError(
        400,
        "proof_expired",
        "This verification expired or belongs to another request. Verify again.",
      );
    const expectedHash = hashSignal(`${purpose}:${dropId}:${challengeId}`);
    // Pin ONE protocol and credential family for the whole deployment. Accepting both
    // v3 and v4 nullifiers without an identity migration enables duplicate people.
    const allowed =
      config.protocol === "3.0"
        ? config.credential === "orb"
          ? ["orb"]
          : ["document", "secure_document"]
        : config.credential === "orb"
          ? ["proof_of_human"]
          : ["passport"];
    const candidates = proof.responses.filter(
      (p) =>
        allowed.includes(p.identifier) &&
        sameInteger(p.signal_hash, expectedHash),
    );
    if (candidates.length !== 1)
      throw new AppError(
        400,
        "credential_needed",
        "The required credential and drop-bound signal were not provided.",
      );
    if (purpose === "collect" && !config.pickupAllowed)
      throw new AppError(
        503,
        "presence_unvalidated",
        "Pickup liveness has not been validated.",
      );
    // In staging, this is explicitly an untested liveness fallback. Do not mistake
    // a browser-supplied user_presence_completed flag for server-attested liveness.
    let response: Response;
    try {
      // R2: verification boundary. Forward the exact received bytes, without remapping.
      response = await fetcher(
        `https://developer.world.org/api/v4/verify/${encodeURIComponent(config.rp_id)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: rawBody,
          signal: AbortSignal.timeout(15000),
        },
      );
    } catch {
      throw new AppError(
        503,
        "world_unavailable",
        "World verification is unavailable. Try again shortly. Nothing was saved.",
      );
    }
    if (response.status === 429 || response.status >= 500)
      throw new AppError(
        503,
        "world_unavailable",
        "World verification is unavailable. Try again shortly. Nothing was saved.",
      );
    if (!response.ok)
      throw new AppError(
        400,
        "verification_failed",
        "World ID verification failed. Nothing was saved.",
      );
    let result: ReturnType<typeof verifySchema.safeParse>;
    try {
      result = verifySchema.safeParse(await response.json());
    } catch {
      throw new AppError(
        503,
        "world_unavailable",
        "World returned an unreadable response. Try again shortly.",
      );
    }
    if (!result.success)
      throw new AppError(
        400,
        "verification_failed",
        "World did not confirm this proof. Nothing was saved.",
      );
    const verified = result.data;
    const candidate = candidates[0];
    const accepted = verified.results.find(
      (r) =>
        r.success &&
        r.identifier === candidate.identifier &&
        r.nullifier &&
        sameInteger(r.nullifier, candidate.nullifier),
    );
    if (
      verified.environment !== config.environment ||
      verified.action !== config.action ||
      !accepted?.nullifier
    )
      throw new AppError(
        400,
        "verification_failed",
        "World did not verify the required identity for this request.",
      );
    const code = anonymousCode(
      accepted.nullifier,
      `${config.app_id}:${config.action}:${config.protocol}`,
    );
    outcome = "verified";
    return { code, challengeId, policy };
  } catch (error) {
    if (error instanceof AppError && error.status === 503)
      outcome =
        error.code === "world_unavailable" ? "unavailable" : "configuration";
    throw error;
  } finally {
    // Only operational timings: no proof, nullifier, code, request body or IP.
    await db.query(
      "INSERT INTO proof_log(route,outcome,duration_ms) VALUES($1,$2,$3)",
      [purpose, outcome, Math.round(performance.now() - start)],
    );
  }
}
