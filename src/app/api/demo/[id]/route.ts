import { z } from "zod";
import { database } from "@/lib/db";
import { handle, readJson, requireLocalDemo } from "@/lib/http";
import { demoCode } from "@/lib/domain";
import { enterDrop, collectDrop } from "@/lib/service";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    requireLocalDemo(request);
    const body = z
      .object({
        identity: z.enum(["fan-a", "fan-b", "fan-c", "fan-d", "fan-e"]),
        purpose: z.enum(["enter", "collect"]),
      })
      .parse(await readJson(request));
    const db = await database();
    const identity = { code: demoCode(body.identity), demo: true };
    const { id } = await context.params;
    return body.purpose === "enter"
      ? enterDrop(db, id, identity)
      : collectDrop(db, id, identity);
  });
}
