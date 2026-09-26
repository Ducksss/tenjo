// Pure and isomorphic: the code a Sui wallet gives a real World ID's entries, and the message the
// wallet signs to link a free entry. The server enforces both; the drop page previews with them.
import { sha256 } from "@noble/hashes/sha2";
import { normalizeSuiAddress, toHex } from "@mysten/sui/utils";

/**
 * A real World ID gets a fresh anonymous code in every drop. Entered with a wallet, it uses this
 * code instead, so the loss ledger (in the database and on Sui) follows the wallet across a series.
 */
export function walletCode(address: string) {
  return toHex(
    sha256(
      new TextEncoder().encode(
        `tenjo:v1:wallet:${normalizeSuiAddress(address)}`,
      ),
    ),
  ).slice(0, 32);
}

/** What a wallet signs to link a free entry: this drop, this wallet and this one World ID request. */
export function walletLinkMessage(
  dropId: string,
  address: string,
  challengeId: string,
) {
  return [
    "Tenjō: keep my extra chances with this wallet.",
    `Drop: ${dropId}`,
    `Wallet: ${normalizeSuiAddress(address)}`,
    `Request: ${challengeId}`,
  ].join("\n");
}
