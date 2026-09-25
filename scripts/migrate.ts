import { database, migrate } from "../src/lib/db";
const db = await database();
await migrate(db);
await db.close();
console.log("Tenjo schema applied.");
