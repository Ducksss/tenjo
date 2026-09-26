import { database } from "../src/lib/db";
import { createDrop, drawDrop } from "../src/lib/service";
if (!process.env.TENJO_E2E || process.env.DATABASE_URL || process.env.VERCEL)
  throw new Error("Test fixtures require an isolated local test database.");
// Real (not demo) drops for tests/world-entry.spec.ts, which plays World App, the wallet and Sui itself.
const db = await database();
const now = Date.now();
const window = (closesIn: number) => ({
  opens_at: new Date(now - 60000).toISOString(),
  closes_at: new Date(now + closesIn).toISOString(),
});
await createDrop(
  db,
  {
    title: "World ID free drop",
    series_id: "world-free",
    series_name: "World free",
    items: 1,
    ...window(3600000),
  },
  { id: "world-free" },
);
// Priced drops need Sui, which is off here: create it free, then give it a deposit and
// placeholder object IDs. The browser test answers every permit and confirmation itself.
await createDrop(
  db,
  {
    title: "World ID paid drop",
    series_id: "world-paid",
    series_name: "World paid",
    items: 1,
    ...window(3600000),
  },
  { id: "world-paid" },
);
await db.query(
  "UPDATE series SET sui_series_id=$1,sui_package_id=$2 WHERE id='world-paid'",
  ["0x" + "22".repeat(32), "0x" + "33".repeat(32)],
);
await db.query(
  "UPDATE drops SET price_mist=10000000,sui_drop_id=$1,sui_network='testnet',coin_type='0x2::sui::SUI' WHERE id='world-paid'",
  ["0x" + "11".repeat(32)],
);
// Drawn with no entries, so pickup can be started and abandoned.
await createDrop(
  db,
  {
    title: "World ID settled drop",
    series_id: "world-settled",
    series_name: "World settled",
    items: 1,
    ...window(1000),
  },
  { id: "world-settled" },
);
await new Promise((resolve) => setTimeout(resolve, 1500));
await drawDrop(db, "world-settled");
await db.close();
