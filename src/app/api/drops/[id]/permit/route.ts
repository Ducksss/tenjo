import { database } from "@/lib/db";
import {
  handle,
  readBody,
  requireSameOrigin,
  suiAddressHeader,
} from "@/lib/http";
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
    // Refuse before World verification, so a free drop never spends a proof here.
    await requireDepositDrop(db, id);
    const identity = await verifyWorldProof(
      db,
      raw,
      request.headers.get("x-tenjo-challenge") || "",
      id,
      "enter",
    );
    return permitEntry(db, id, identity, sender);
  });
}
