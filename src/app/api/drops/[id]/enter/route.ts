import { database } from "@/lib/db";
import { handle, readBody, requireSameOrigin } from "@/lib/http";
import { linkPasskey, passkeyForEntry } from "@/lib/passkey";
import { enterDrop } from "@/lib/service";
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
    // An optional passkey is checked first, so a refusal never spends the World ID proof.
    const passkey = await passkeyForEntry(db, request, id, challengeId);
    const identity = await verifyWorldProof(db, raw, challengeId, id, "enter");
    return enterDrop(db, id, linkPasskey(identity, passkey));
  });
}
