import { database } from "@/lib/db";
import { handle, requireSameOrigin } from "@/lib/http";
import { drawDrop } from "@/lib/service";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    requireSameOrigin(request);
    return drawDrop(await database(), (await context.params).id);
  });
}
