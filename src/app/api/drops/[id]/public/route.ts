import { database } from "@/lib/db";
import { handle, pageNumber } from "@/lib/http";
import { publicDrop } from "@/lib/service";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const q = new URL(request.url).searchParams;
    return publicDrop(
      await database(),
      (await context.params).id,
      pageNumber(q.get("page")),
      (q.get("q") || "").replace(/[^a-fA-F0-9]/g, "").slice(0, 32),
    );
  });
}
