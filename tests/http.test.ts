import { test } from "node:test";
import assert from "node:assert/strict";
import { requireSameOrigin, requireLocalDemo, readBody } from "../src/lib/http";

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
