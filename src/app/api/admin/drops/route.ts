import { database } from "@/lib/db";
import { handle, readJson, requireAdmin } from "@/lib/http";
import { createDrop } from "@/lib/service";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return handle(async () => {
    requireAdmin(request);
    return createDrop(await database(), await readJson(request));
  });
}
