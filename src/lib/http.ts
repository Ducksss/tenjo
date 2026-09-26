import { timingSafeEqual, createHash } from "node:crypto";
import { ZodError } from "zod";
import { AppError } from "./domain";
export const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function handle(work: () => Promise<unknown>) {
  try {
    return json(await work());
  } catch (error) {
    if (error instanceof AppError)
      return json(
        { ...error.details, error: error.message, code: error.code },
        error.status,
      );
    if (error instanceof ZodError)
      return json(
        {
          error: error.issues[0]?.message || "Check the form fields.",
          code: "invalid_input",
          fields: error.flatten().fieldErrors,
        },
        400,
      );
    // Never log exception objects: upstream and DB errors can contain sensitive values.
    return json(
      {
        error:
          "This request could not be completed. Refresh the public record before trying again.",
        code: "server_error",
      },
      500,
    );
  }
}
export async function readBody(request: Request, max = 65536) {
  const reader = request.body?.getReader();
  if (!reader)
    throw new AppError(400, "empty_body", "A request body is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      throw new AppError(413, "too_large", "Request is too large.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
export async function readJson(request: Request) {
  const body = await readBody(request);
  try {
    return JSON.parse(body);
  } catch {
    throw new AppError(400, "invalid_json", "Invalid request body.");
  }
}
export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  // Next may normalize the internal URL to localhost. Compare the browser's
  // Origin with the actual Host authority; APP_ORIGIN pins the deployed origin.
  const url = new URL(request.url);
  const expected =
    process.env.APP_ORIGIN ||
    `${url.protocol}//${request.headers.get("host") || url.host}`;
  if (origin && origin !== expected)
    throw new AppError(403, "origin", "Use this app to submit the request.");
}
export function requireAdmin(request: Request) {
  requireSameOrigin(request);
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret || secret.length < 16)
    throw new AppError(
      503,
      "admin_not_configured",
      "Set an ADMIN_PASSWORD of at least 16 characters on the server.",
    );
  const actual = request.headers.get("authorization") || "";
  const hash = (s: string) => createHash("sha256").update(s).digest();
  if (!timingSafeEqual(hash(actual), hash(`Bearer ${secret}`)))
    throw new AppError(
      401,
      "unauthorized",
      "The organiser password is incorrect.",
    );
}
export function requireLocalDemo(request: Request) {
  requireSameOrigin(request);
  if (
    process.env.TENJO_DEMO_MODE !== "true" ||
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL
  )
    throw new AppError(404, "not_found", "Local demo is disabled.");
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(new URL(request.url).hostname)
  )
    throw new AppError(
      403,
      "local_only",
      "Demo controls only work on localhost.",
    );
}
export function pageNumber(input: string | undefined | null) {
  const p = Number(input || 1);
  return Number.isSafeInteger(p) && p > 0 ? Math.min(p, 10000) : 1;
}
/** The connected Sui wallet, from `x-tenjo-sui-address` (0x + 64 hex). */
export function suiAddressHeader(request: Request) {
  const address = (request.headers.get("x-tenjo-sui-address") || "").trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(address))
    throw new AppError(400, "invalid_address", "Connect a Sui wallet first.");
  return address.toLowerCase();
}
