import { createHash } from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeDatabase, migrate } from "../src/lib/db";
import {
  anonymousCode,
  canonicalJson,
  demoCode,
  ticketsFor,
  weightedDraw,
} from "../src/lib/domain";
import {
  createDrop,
  enterDrop,
  drawDrop,
  collectDrop,
  codeHistory,
  publicDrop,
} from "../src/lib/service";

async function setup() {
  const db = await makeDatabase("memory://");
  await migrate(db);
  return db;
}
const t = Date.now();
const input = (series = "series") => ({
  title: "Test console drop",
  series_id: series,
  series_name: "Test series",
  items: 1,
  opens_at: new Date(t - 1000).toISOString(),
  closes_at: new Date(t + 1000).toISOString(),
});
const fan = (name: string) => ({ code: demoCode(name), demo: true });

test("stable canonical code: casing and leading zeroes cannot split an identity", () => {
  assert.equal(
    anonymousCode("0x01", "scope"),
    anonymousCode("0x0001", "scope"),
  );
  assert.equal(anonymousCode("0xAB", "scope"), anonymousCode("0xab", "scope"));
  assert.notEqual(
    anonymousCode("0x01", "scope"),
    anonymousCode("0x02", "scope"),
  );
  assert.notEqual(
    anonymousCode("0x01", "scope"),
    anonymousCode("0x01", "another"),
  );
});
test("ticket cap and exhaustive first-pick probability", () => {
  assert.equal(ticketsFor(3), 4);
  assert.equal(ticketsFor(9), 6);
  const entrants = [
    { member_code: "a", tickets: 1 },
    { member_code: "b", tickets: 3 },
    { member_code: "c", tickets: 6 },
  ];
  const tally: { [code: string]: number } = { a: 0, b: 0, c: 0 };
  for (let roll = 0; roll < 10; roll++)
    tally[weightedDraw(entrants, 1, () => roll)[0].member_code]++;
  assert.deepEqual(tally, { a: 1, b: 3, c: 6 });
  const picks = weightedDraw(entrants, 3, () => 0);
  assert.equal(new Set(picks.map((p) => p.member_code)).size, 3);
  assert.deepEqual(
    picks.map((p) => p.pool_tickets),
    [10, 9, 6],
  );
});
test("entry races, early draw, exactly-once settlement, next-drop pity and winner-only pickup", async () => {
  const db = await setup();
  try {
    const d = await createDrop(db, input(), { demo: true });
    const raced = await Promise.allSettled([
      enterDrop(db, d.id, fan("a"), new Date(t)),
      enterDrop(db, d.id, fan("a"), new Date(t)),
    ]);
    assert.equal(raced.filter((r) => r.status === "fulfilled").length, 1);
    await enterDrop(db, d.id, fan("b"), new Date(t));
    await assert.rejects(drawDrop(db, d.id, new Date(t)), /not open yet/);
    assert.equal((await db.query("SELECT * FROM results")).rows.length, 0);
    await assert.rejects(createDrop(db, input(), { demo: true }), /Settle/);
    const draws = await Promise.all([
      drawDrop(db, d.id, new Date(t + 2000), () => 0),
      drawDrop(db, d.id, new Date(t + 2000), () => 0),
    ]);
    assert.deepEqual(draws[0], draws[1]);
    const audit = await publicDrop(db, d.id);
    assert.equal(audit.winners.length, 1);
    assert.equal(
      audit.record!.record_hash,
      createHash("sha256")
        .update(canonicalJson(audit.record!.record))
        .digest("hex"),
    );
    assert.equal(audit.entries.length, 2);
    const winner = audit.winners[0].member_code;
    const loser = audit.entries.find(
      (e) => e.member_code !== winner,
    )!.member_code;
    assert.equal((await codeHistory(db, loser)).pity[0].losses, 1);
    assert.equal((await codeHistory(db, winner)).pity[0].losses, 0);
    await assert.rejects(
      collectDrop(db, d.id, { code: loser, demo: true }),
      /Pickup refused/,
    );
    await collectDrop(db, d.id, { code: winner, demo: true });
    await assert.rejects(
      collectDrop(db, d.id, { code: winner, demo: true }),
      /already collected/,
    );
    const next = await createDrop(db, input(), { demo: true });
    const entry = await enterDrop(
      db,
      next.id,
      { code: loser, demo: true },
      new Date(t),
    );
    assert.equal(entry.tickets, 2);
    const other = await createDrop(db, input("different-series"), {
      demo: true,
    });
    assert.equal(
      (await enterDrop(db, other.id, { code: loser, demo: true }, new Date(t)))
        .tickets,
      1,
    );
  } finally {
    await db.close();
  }
});
test("empty and undersubscribed drops settle honestly and local identity cannot enter real drop", async () => {
  const db = await setup();
  try {
    const d = await createDrop(db, { ...input(), items: 3 }, { demo: true });
    await enterDrop(db, d.id, fan("solo"), new Date(t));
    await drawDrop(db, d.id, new Date(t + 2000));
    const a = await publicDrop(db, d.id);
    assert.equal(a.winners.length, 1);
    assert.equal(a.record!.record.unallocated, 2);
    const empty = await createDrop(db, input(), { demo: true });
    await drawDrop(db, empty.id, new Date(t + 2000));
    assert.equal((await publicDrop(db, empty.id)).winners.length, 0);
    const real = await createDrop(db, input("real"));
    await assert.rejects(
      enterDrop(db, real.id, fan("x"), new Date(t)),
      /Demo identities/,
    );
  } finally {
    await db.close();
  }
});
