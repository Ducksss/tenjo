// Passkey-linked pity for real World IDs. World ID 4 gives a real World ID a fresh code in every
// drop, so its losses can't carry over. A passkey the entrant creates here gives their entries a
// stable code instead; the per-drop World ID proof still decides who may enter. The entry checks
// here run before World verification, so a refusal never spends the proof.
import {
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { z } from "zod";
import type { SQL } from "./db";
import { AppError } from "./domain";
import { expectedOrigin } from "./http";
import { base64url, passkeyChallenge, passkeyCode } from "./passkey-code";
import type { VerifiedIdentity } from "./service";
import { realWorldConfig } from "./world";

/** WebAuthn binds a passkey to this site: the origin browsers report and its host name. */
function relyingParty(request: Request) {
  const origin = expectedOrigin(request);
  return { origin, rpID: new URL(origin).hostname };
}

/** An open real-World-ID entry request: the only kind a passkey links. The simulator keeps one
 * code, so its losses already carry. */
async function realChallenge(db: SQL, dropId: string, challengeId: string) {
  if (!realWorldConfig()) return false;
  const { rows } = await db.query<{ mode: string }>(
    "SELECT mode FROM challenges WHERE id=$1 AND drop_id=$2 AND purpose='enter' AND used_at IS NULL AND expires_at>now()",
    [challengeId, dropId],
  );
  return rows[0]?.mode === "production";
}

const registration = z.object({
  drop_id: z.string().min(1).max(100),
  challenge_id: z.string().min(1).max(100),
  response: z.record(z.string(), z.unknown()),
});

/**
 * Stores a new passkey, created for one real World ID entry request. Only its public key is kept:
 * the passkey's own signatures decide later entries. Its creation counts as that entry's proof.
 */
export async function registerPasskey(db: SQL, request: Request, raw: unknown) {
  const data = registration.parse(raw);
  if (!(await realChallenge(db, data.drop_id, data.challenge_id)))
    throw new AppError(
      400,
      "passkey_request",
      "Start a real World ID entry, then create the passkey. Nothing was saved.",
    );
  const { origin, rpID } = relyingParty(request);
  const verified = await verifyRegistrationResponse({
    response: data.response as unknown as RegistrationResponseJSON,
    expectedChallenge: passkeyChallenge(
      "create",
      data.drop_id,
      data.challenge_id,
    ),
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: false,
  }).catch(() => null);
  if (!verified?.verified)
    throw new AppError(
      400,
      "passkey_invalid",
      "That passkey couldn't be checked. Nothing was saved.",
    );
  const { credential } = verified.registrationInfo;
  const code = passkeyCode(credential.id);
  const publicKey = base64url(credential.publicKey);
  await db.query(
    "INSERT INTO passkeys(credential_id,public_key,counter,member_code,created_challenge) VALUES($1,$2,$3,$4,$5) ON CONFLICT (credential_id) DO NOTHING",
    [credential.id, publicKey, credential.counter, code, data.challenge_id],
  );
  const stored = (
    await db.query<{ public_key: string }>(
      "SELECT public_key FROM passkeys WHERE credential_id=$1",
      [credential.id],
    )
  ).rows[0];
  if (stored.public_key !== publicKey)
    throw new AppError(
      409,
      "passkey_taken",
      "That passkey is registered with another key. Create a new one.",
    );
  return { code };
}

const entryProof = z.union([
  z.object({ created: z.string().min(1).max(1024) }),
  z.object({ assertion: z.record(z.string(), z.unknown()) }),
]);
export type LinkedPasskey = { code: string; credentialId: string };

/**
 * An entry's optional passkey, from the `x-tenjo-passkey` header (base64url JSON): the passkey just
 * created for this World ID request, or a passkey signature over this drop and request. Returns
 * the code its entries use, or null when nothing links.
 */
export async function passkeyForEntry(
  db: SQL,
  request: Request,
  dropId: string,
  challengeId: string,
): Promise<LinkedPasskey | null> {
  const header = request.headers.get("x-tenjo-passkey");
  if (!header || !(await realChallenge(db, dropId, challengeId))) return null;
  let proof: z.infer<typeof entryProof>;
  try {
    proof = entryProof.parse(
      JSON.parse(Buffer.from(header, "base64url").toString("utf8")),
    );
  } catch {
    throw new AppError(
      400,
      "passkey_invalid",
      "Your passkey's answer couldn't be read. Nothing was saved.",
    );
  }
  const credentialId =
    "created" in proof ? proof.created : String(proof.assertion.id ?? "");
  const passkey = (
    await db.query<{
      credential_id: string;
      public_key: string;
      counter: string | number;
      member_code: string;
      created_challenge: string | null;
    }>(
      "SELECT credential_id,public_key,counter,member_code,created_challenge FROM passkeys WHERE credential_id=$1",
      [credentialId],
    )
  ).rows[0];
  if (!passkey)
    throw new AppError(
      400,
      "passkey_unknown",
      "Tenjō doesn't know this passkey, so nothing was saved. Enter again to create a new one.",
    );
  if ("created" in proof) {
    // Created for this very request, so creating it was the proof.
    if (passkey.created_challenge !== challengeId)
      throw new AppError(
        400,
        "passkey_invalid",
        "That passkey was created for another entry. Nothing was saved.",
      );
  } else {
    const { origin, rpID } = relyingParty(request);
    const verified = await verifyAuthenticationResponse({
      response: proof.assertion as unknown as AuthenticationResponseJSON,
      expectedChallenge: passkeyChallenge("get", dropId, challengeId),
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: passkey.credential_id,
        publicKey: new Uint8Array(Buffer.from(passkey.public_key, "base64url")),
        counter: Number(passkey.counter),
      },
      requireUserVerification: false,
    }).catch(() => null);
    if (!verified?.verified)
      throw new AppError(
        400,
        "passkey_invalid",
        "That passkey signature doesn't match this entry. Nothing was saved.",
      );
    await db.query(
      "UPDATE passkeys SET counter=GREATEST(counter,$2) WHERE credential_id=$1",
      [passkey.credential_id, verified.authenticationInfo.newCounter],
    );
  }
  // One entry per passkey per drop.
  const taken = await db.query(
    "SELECT 1 FROM entries WHERE drop_id=$1 AND member_code=$2",
    [dropId, passkey.member_code],
  );
  if (taken.rows.length)
    throw new AppError(
      409,
      "passkey_in_use",
      "This passkey already has an entry in this drop. Use your own passkey, or enter with World ID alone.",
    );
  return { code: passkey.member_code, credentialId: passkey.credential_id };
}

/** A real World ID entered with a passkey uses the passkey's code; its drop code stays as `person`. */
export function linkPasskey(
  identity: VerifiedIdentity,
  passkey: LinkedPasskey | null,
): VerifiedIdentity {
  if (!passkey || identity.mode !== "production") return identity;
  return {
    ...identity,
    person: identity.code,
    code: passkey.code,
    passkey: passkey.credentialId,
  };
}
