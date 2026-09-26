import { database } from "@/lib/db";
import { handle, readBody, requireSameOrigin } from "@/lib/http";
import { enterDrop } from "@/lib/service";
import { linkWallet, walletForEntry } from "@/lib/wallet";
import { verifyWorldProof } from "@/lib/world";
export const runtime = "nodejs";
// Sui transactions can take a few seconds each.
export const maxDuration = 60;
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    requireSameOrigin(request);
    const { id } = await context.params;
    const raw = await readBody(request);
    const db = await database();
    const challengeId = request.headers.get("x-tenjo-challenge") || "";
    // An optional wallet is checked first, so a refusal never spends the World ID proof.
    const wallet = await walletForEntry(
      db,
      id,
      challengeId,
      request.headers.get("x-tenjo-sui-address")?.trim() || null,
      request.headers.get("x-tenjo-wallet-signature")?.trim() || null,
    );
    const identity = await verifyWorldProof(db, raw, challengeId, id, "enter");
    return enterDrop(db, id, linkWallet(identity, wallet));
  });
}
