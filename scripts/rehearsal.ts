import os from "node:os";
import path from "node:path";
if (
  process.env.NODE_ENV === "production" ||
  process.env.VERCEL ||
  process.env.DATABASE_URL
)
  throw new Error("Rehearsals are local only.");
process.env.TENJO_LOCAL_DB ||= path.join(
  os.tmpdir(),
  `tenjo-rehearsal-${Date.now()}`,
);
process.env.TENJO_DEMO_WINDOW_SECONDS = "120";
await import("./seed");
console.log("Two-minute entry window. Stop any running dev server, then run:");
console.log(`TENJO_LOCAL_DB=${process.env.TENJO_LOCAL_DB} npm run dev:demo`);
console.log(
  "Open /drops/weekend-drop. Fan A has three setup losses, so its new entry receives four tickets.",
);
