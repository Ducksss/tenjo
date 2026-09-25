import { z } from "zod";
import { database } from "@/lib/db";
import { handle, readJson, requireSameOrigin } from "@/lib/http";
import { issueChallenge } from "@/lib/world";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return handle(async () => {
    requireSameOrigin(request);
    const data = z
      .object({
        drop_id: z.string().min(1).max(100),
        purpose: z.enum(["enter", "collect"]),
      })
      .parse(await readJson(request));
    return issueChallenge(await database(), data.drop_id, data.purpose);
  });
}
