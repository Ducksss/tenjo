import { database } from "../src/lib/db";
const db = await database();
const summary = await db.query(
  `SELECT route,outcome,count(*)::int AS attempts,round(avg(duration_ms))::int AS average_ms,min(created_at) AS first_at,max(created_at) AS last_at FROM proof_log GROUP BY route,outcome ORDER BY first_at`,
);
console.table(summary.rows);
const first = await db.query<{ at: string | null }>(
  "SELECT min(created_at) AS at FROM proof_log WHERE outcome='verified'",
);
console.log(
  first.rows[0].at
    ? `First verified proof: ${new Date(first.rows[0].at).toISOString()}`
    : "No real proof has been verified in this database yet.",
);
if (process.env.WORLD_INTEGRATION_STARTED_AT && first.rows[0].at) {
  const duration =
    new Date(first.rows[0].at).getTime() -
    Date.parse(process.env.WORLD_INTEGRATION_STARTED_AT);
  if (Number.isFinite(duration) && duration >= 0)
    console.log(
      `Time to first verified proof: ${Math.round(duration / 1000)} seconds from the configured start.`,
    );
}
await db.close();
