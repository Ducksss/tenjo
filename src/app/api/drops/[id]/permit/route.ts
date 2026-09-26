import { database } from "@/lib/db";
import {
  handle,
  readBody,
  requireSameOrigin,
  suiAddressHeader,
} from "@/lib/http";
import { permitEntry, requireDepositDrop } from "@/lib/service";
import { linkWallet, walletForPermit } from "@/lib/wallet";
import { verifyWorldProof } from "@/lib/world";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    requireSameOrigin(request);
    const { id } = await context.params;
    const sender = suiAddressHeader(request);
    const raw = await readBody(request);
    const db = await database();
    const challengeId = request.headers.get("x-tenjo-challenge") || "";
    // Refuse before World verification, so a free drop or a used wallet never spends a proof here.
    await requireDepositDrop(db, id);
    const wallet = await walletForPermit(db, id, challengeId, sender);
    const identity = await verifyWorldProof(db, raw, challengeId, id, "enter");
    return permitEntry(db, id, linkWallet(identity, wallet), sender);
  });
}
