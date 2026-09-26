import { database } from "@/lib/db";
import {
  handle,
  readBody,
  requireSameOrigin,
  suiAddressHeader,
} from "@/lib/http";
import { linkPasskey, passkeyForEntry } from "@/lib/passkey";
import { permitEntry, requireDepositDrop } from "@/lib/service";
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
    // Refuse before World verification, so a free drop or a used passkey never spends a proof here.
    await requireDepositDrop(db, id);
    const passkey = await passkeyForEntry(db, request, id, challengeId);
    const identity = await verifyWorldProof(db, raw, challengeId, id, "enter");
    return permitEntry(db, id, linkPasskey(identity, passkey), sender);
  });
}
