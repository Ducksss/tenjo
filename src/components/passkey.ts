"use client";
// Browser side of passkey-linked pity: creates or uses this site's passkey for one World ID request.
import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import { api } from "@/lib/client-api";
import { base64url, passkeyChallenge } from "@/lib/passkey-code";

const KEY = "tenjo:passkey";
export const passkeysSupported = () => browserSupportsWebAuthn();
/** The passkey this browser created or last used here, if any. */
export function rememberedPasskey() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
function remember(credentialId: string) {
  try {
    localStorage.setItem(KEY, credentialId);
  } catch {}
}
export function forgetPasskey() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
const header = (proof: object) =>
  base64url(new TextEncoder().encode(JSON.stringify(proof)));

/**
 * Proves the entrant's passkey for one World ID request and returns the `x-tenjo-passkey` header.
 * `use` signs with the remembered passkey, `discover` lets the device offer any Tenjō passkey (one
 * synced from another device), and `create` makes a new one: the server stores it, and creating it
 * counts as this entry's proof, so there is no second prompt.
 */
export async function passkeyProof(
  dropId: string,
  challengeId: string,
  mode: "use" | "discover" | "create",
) {
  const rpId = window.location.hostname;
  if (mode === "create") {
    const created = await startRegistration({
      optionsJSON: {
        rp: { name: "Tenjō", id: rpId },
        user: {
          id: base64url(crypto.getRandomValues(new Uint8Array(16))),
          name: "Tenjō extra chances",
          displayName: "Tenjō extra chances",
        },
        challenge: passkeyChallenge("create", dropId, challengeId),
        // Ed25519, P-256 and RSA: what platform authenticators and security keys offer.
        pubKeyCredParams: [-8, -7, -257].map((alg) => ({
          type: "public-key" as const,
          alg,
        })),
        authenticatorSelection: {
          residentKey: "required",
          requireResidentKey: true,
          userVerification: "preferred",
        },
        attestation: "none",
        timeout: 60000,
      },
    });
    await api("/api/passkeys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        drop_id: dropId,
        challenge_id: challengeId,
        response: created,
      }),
    });
    remember(created.id);
    return header({ created: created.id });
  }
  const remembered = rememberedPasskey();
  const signed = await startAuthentication({
    optionsJSON: {
      challenge: passkeyChallenge("get", dropId, challengeId),
      rpId,
      allowCredentials:
        mode === "use" && remembered
          ? [{ id: remembered, type: "public-key" }]
          : [],
      userVerification: "preferred",
      timeout: 60000,
    },
  });
  remember(signed.id);
  return header({ assertion: signed });
}
