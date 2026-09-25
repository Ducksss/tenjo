import test from "node:test";
import assert from "node:assert/strict";
import { jstInputValue, jstInputToISO } from "../src/lib/date-input";
test("JST wall times preserve the intended instant across day and year boundaries", () => {
  assert.equal(jstInputToISO("2027-01-01T00:30"), "2026-12-31T15:30:00.000Z");
  assert.equal(
    jstInputValue(new Date("2026-12-31T15:30:00.000Z")),
    "2027-01-01T00:30",
  );
  assert.equal(jstInputToISO("2026-09-26T13:00"), "2026-09-26T04:00:00.000Z");
});
test("date inputs reject missing, malformed and silently rolled-over dates", () => {
  for (const input of [
    "",
    "2026-02-30T10:00",
    "2026-02-29T10:00",
    "2026-09-26T24:00",
    "2026-09-26T13:00+09:00",
  ])
    assert.equal(jstInputToISO(input), null);
  assert.equal(jstInputToISO("2028-02-29T10:00"), "2028-02-29T01:00:00.000Z");
});
