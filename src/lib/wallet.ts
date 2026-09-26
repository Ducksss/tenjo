// Wallet-linked pity for real World IDs. World ID 4 gives a real World ID a fresh code in every
// drop, so its losses can't carry over. A Sui wallet the entrant holds gives their entries a stable
// code instead; the per-drop World ID proof still decides who may enter. Both checks here run
// before World verification, so a refusal never spends the proof.
import { normalizeSuiAddress } from "@mysten/sui/utils";
import type { SQL } from "./db";
import { AppError } from "./domain";
import type { VerifiedIdentity } from "./service";
import { suiChain } from "./sui";
import { walletCode, walletLinkMessage } from "./wallet-code";
import { realWorldConfig } from "./world";

/** Only a real World ID links a wallet: the simulator keeps one code, so its losses already carry. */
async function realChallenge(db: SQL, dropId: string, challengeId: string) {
  if (!realWorldConfig()) return false;
  const { rows } = await db.query<{ mode: string }>(
    "SELECT mode FROM challenges WHERE id=$1 AND drop_id=$2",
    [challengeId, dropId],
  );
  return rows[0]?.mode === "production";
}

/** One entry per wallet per drop. */
async function requireWalletFree(db: SQL, dropId: string, address: string) {
  const { rows } = await db.query(
    "SELECT 1 FROM entries WHERE drop_id=$1 AND member_code=$2",
    [dropId, walletCode(address)],
  );
  if (rows.length)
    throw new AppError(
      409,
      "wallet_in_use",
      "This wallet already has an entry in this drop. Use another wallet, or enter with World ID alone.",
    );
}

/**
 * A free entry's optional wallet. The server registers free entries itself, so the wallet proves
 * it's yours by signing this drop and this World ID request. Returns null when nothing links.
 */
export async function walletForEntry(
  db: SQL,
  dropId: string,
  challengeId: string,
  address: string | null,
  signature: string | null,
) {
  if (!address || !(await realChallenge(db, dropId, challengeId))) return null;
  if (!/^0x[0-9a-fA-F]{64}$/.test(address) || !signature)
    throw new AppError(
      400,
      "wallet_signature",
      "Sign with your wallet to keep your extra chances, or disconnect it to enter with World ID alone.",
    );
  let valid: boolean;
  try {
    valid = await suiChain.verifyPersonalSignature(
      new TextEncoder().encode(walletLinkMessage(dropId, address, challengeId)),
      signature,
      address,
    );
  } catch {
    throw new AppError(
      503,
      "sui_unavailable",
      "Your wallet signature couldn't be checked just now. Nothing was saved. Try again, or disconnect the wallet to enter with World ID alone.",
    );
  }
  if (!valid)
    throw new AppError(
      400,
      "wallet_signature",
      "That wallet signature doesn't match this entry. Nothing was saved.",
    );
  await requireWalletFree(db, dropId, address);
  return normalizeSuiAddress(address);
}

/** A paid entry's wallet is its sender: the chain checks the permit against it, so no signature is needed. */
export async function walletForPermit(
  db: SQL,
  dropId: string,
  challengeId: string,
  sender: string,
) {
  if (!(await realChallenge(db, dropId, challengeId))) return null;
  await requireWalletFree(db, dropId, sender);
  return normalizeSuiAddress(sender);
}

/** A real World ID entered with a wallet uses the wallet's code; its drop code stays as `person`. */
export function linkWallet(
  identity: VerifiedIdentity,
  wallet: string | null,
): VerifiedIdentity {
  if (!wallet || identity.mode !== "production") return identity;
  return {
    ...identity,
    person: identity.code,
    code: walletCode(wallet),
    wallet: normalizeSuiAddress(wallet),
  };
}
