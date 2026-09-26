import { database } from "@/lib/db";
import { handle, readJson, requireSameOrigin } from "@/lib/http";
import { registerPasskey } from "@/lib/passkey";
export const runtime = "nodejs";
/** Registers a passkey created for a real World ID entry, so its losses can carry over. */
export async function POST(request: Request) {
  return handle(async () => {
    requireSameOrigin(request);
    return registerPasskey(await database(), request, await readJson(request));
  });
}
