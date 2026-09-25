import { database } from "../src/lib/db";
import { createDrop, enterDrop } from "../src/lib/service";
import { demoCode } from "../src/lib/domain";
if (!process.env.TENJO_E2E || process.env.DATABASE_URL || process.env.VERCEL)
  throw new Error("Test fixtures require an isolated local test database.");
const db = await database();
const now = Date.now();
const drop = await createDrop(
  db,
  {
    title: "Closed rehearsal drop",
    description: "Isolated browser test fixture.",
    series_id: "e2e-closed",
    series_name: "Browser test",
    items: 3,
    opens_at: new Date(now - 60000).toISOString(),
    closes_at: new Date(now - 30000).toISOString(),
  },
  { demo: true, id: "closed-rehearsal" },
);
for (const fan of ["fan-a", "fan-b", "fan-c", "fan-d", "fan-e"])
  await enterDrop(
    db,
    drop.id,
    { code: demoCode(fan), demo: true },
    new Date(now - 45000),
  );
await db.close();
