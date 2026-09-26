import { test } from "node:test";
import assert from "node:assert/strict";
import { entryStatus } from "../src/lib/entry-status";

test("an unregistered entry is never presented as waiting for a completed draw", () => {
  assert.equal(
    entryStatus({
      outcome: null,
      sui_status: "pending",
      drop_state: "settled",
    }),
    "Not included in draw",
  );
  assert.equal(
    entryStatus({ outcome: null, sui_status: "pending", drop_state: "open" }),
    "Awaiting Sui registration",
  );
  assert.equal(
    entryStatus({
      outcome: null,
      sui_status: "registered",
      drop_state: "open",
    }),
    "Awaiting draw",
  );
  assert.equal(
    entryStatus({ outcome: null, sui_status: null, drop_state: "open" }),
    "Awaiting draw",
  );
  assert.equal(
    entryStatus({
      outcome: "won",
      sui_status: "registered",
      drop_state: "settled",
    }),
    "Won",
  );
  assert.equal(
    entryStatus({
      outcome: "lost",
      sui_status: "registered",
      drop_state: "settled",
    }),
    "Not this time",
  );
});
