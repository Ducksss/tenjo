import { database } from "@/lib/db";
import { handle, readBody, requireSameOrigin } from "@/lib/http";
import { collectDrop } from "@/lib/service";
import { verifyWorldProof } from "@/lib/world";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    requireSameOrigin(request);
    const { id } = await context.params;
    const raw = await readBody(request);
    const db = await database();
    const identity = await verifyWorldProof(
      db,
      raw,
      request.headers.get("x-tenjo-challenge") || "",
      id,
      "collect",
    );
    return collectDrop(db, id, identity);
  });
}
