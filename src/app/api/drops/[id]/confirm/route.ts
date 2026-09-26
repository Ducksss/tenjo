import { z } from "zod";
import { database } from "@/lib/db";
import { handle, readJson, requireSameOrigin } from "@/lib/http";
import { confirmEntry } from "@/lib/service";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    requireSameOrigin(request);
    const { digest } = z
      .object({ digest: z.string().trim().min(32).max(64) })
      .parse(await readJson(request));
    return confirmEntry(await database(), (await context.params).id, digest);
  });
}
