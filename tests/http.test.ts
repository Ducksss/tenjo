import { test } from "node:test";
import assert from "node:assert/strict";
import { AppError } from "../src/lib/domain";
import {
  handle,
  requireSameOrigin,
  requireLocalDemo,
  readBody,
} from "../src/lib/http";

test("origin check accepts Next internal URL normalization but rejects cross-origin mutation", () => {
  assert.doesNotThrow(() =>
    requireSameOrigin(
      new Request("http://localhost:3100/api", {
        headers: { origin: "http://127.0.0.1:3100", host: "127.0.0.1:3100" },
      }),
    ),
  );
  assert.throws(
    () =>
      requireSameOrigin(
        new Request("http://localhost:3100/api", {
          headers: { origin: "https://evil.example", host: "127.0.0.1:3100" },
        }),
      ),
    /Use this app/,
  );
});
test("demo guard cannot run without explicit local opt-in", () => {
  const saved = process.env.TENJO_DEMO_MODE;
  delete process.env.TENJO_DEMO_MODE;
  assert.throws(
    () => requireLocalDemo(new Request("http://localhost:3000/api")),
    /disabled/,
  );
  process.env.TENJO_DEMO_MODE = "true";
  assert.throws(
    () => requireLocalDemo(new Request("https://tenjo.example/api")),
    /localhost/,
  );
  if (saved) process.env.TENJO_DEMO_MODE = saved;
  else delete process.env.TENJO_DEMO_MODE;
});
test("bounded body reader rejects oversized proof uploads", async () => {
  await assert.rejects(
    readBody(
      new Request("http://localhost/api", {
        method: "POST",
        body: "x".repeat(100),
      }),
      10,
    ),
    /too large/,
  );
});
test("a refusal's details reach the client, but never replace its code or message", async () => {
  const response = await handle(async () => {
    throw new AppError(409, "already_entered", "Already entered.", {
      member_code: "a".repeat(32),
      code: "spoofed",
    });
  });
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    member_code: "a".repeat(32),
    error: "Already entered.",
    code: "already_entered",
  });
});
