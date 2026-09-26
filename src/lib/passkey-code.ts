// Pure and isomorphic: the code a passkey gives a real World ID's entries, and the WebAuthn
// challenges that tie a passkey to one drop and one World ID request. Server and browser share them.
import { sha256 } from "@noble/hashes/sha2";
import { toHex } from "@mysten/sui/utils";

const utf8 = (text: string) => new TextEncoder().encode(text);

/** Unpadded base64url, the encoding WebAuthn uses for challenges and credential IDs. */
export function base64url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * A real World ID gets a fresh anonymous code in every drop. Entered with a passkey, it uses this
 * code instead, so the loss ledger (in the database and on Sui) follows the passkey across a series.
 */
export function passkeyCode(credentialId: string) {
  return toHex(sha256(utf8(`tenjo:v1:passkey:${credentialId}`))).slice(0, 32);
}

/** The WebAuthn challenge for creating (`create`) or using (`get`) a passkey in one World ID request. */
export function passkeyChallenge(
  kind: "create" | "get",
  dropId: string,
  challengeId: string,
) {
  return base64url(
    sha256(utf8(`tenjo:passkey:${kind}:v1:${dropId}:${challengeId}`)),
  );
}
