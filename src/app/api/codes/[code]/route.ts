import { database } from "@/lib/db";
import { handle, pageNumber } from "@/lib/http";
import { codeHistory } from "@/lib/service";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  return handle(async () =>
    codeHistory(
      await database(),
      (await context.params).code.toLowerCase(),
      pageNumber(new URL(request.url).searchParams.get("page")),
    ),
  );
}
