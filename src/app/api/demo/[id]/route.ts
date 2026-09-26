import { z } from "zod";
import { database } from "@/lib/db";
import {
  handle,
  readJson,
  requireLocalDemo,
  suiAddressHeader,
} from "@/lib/http";
import { demoCode } from "@/lib/domain";
import { enterDrop, collectDrop, permitEntry } from "@/lib/service";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    requireLocalDemo(request);
    const body = z
      .object({
        identity: z.enum([
          "fan-a",
          "fan-b",
          "fan-c",
          "fan-d",
          "fan-e",
          "fan-f",
        ]),
        purpose: z.enum(["enter", "collect", "permit"]),
      })
      .parse(await readJson(request));
    const db = await database();
    const identity = { code: demoCode(body.identity), demo: true };
    const { id } = await context.params;
    if (body.purpose === "permit")
      return permitEntry(db, id, identity, suiAddressHeader(request));
    return body.purpose === "enter"
      ? enterDrop(db, id, identity)
      : collectDrop(db, id, identity);
  });
}
