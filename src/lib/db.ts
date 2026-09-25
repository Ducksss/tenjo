import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";

export interface SQL {
  query<T = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: T[] }>;
}
export interface Database extends SQL {
  transaction<T>(work: (sql: SQL) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export async function makeDatabase(url?: string): Promise<Database> {
  if (url?.startsWith("postgres")) {
    const pool = new Pool({ connectionString: url, max: 5 });
    return {
      query: async <T>(text: string, values?: unknown[]) => {
        const { rows } = await pool.query(text, values);
        return { rows: rows as T[] };
      },
      async transaction(work) {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const result = await work(client);
          await client.query("COMMIT");
          return result;
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally {
          client.release();
        }
      },
      close: () => pool.end(),
    };
  }
  if (
    process.env.VERCEL ||
    (process.env.NODE_ENV === "production" && !process.env.TENJO_LOCAL_DB)
  ) {
    throw new Error(
      "DATABASE_URL is required for a hosted/production deployment.",
    );
  }
  const localPath =
    url === "memory://"
      ? undefined
      : process.env.TENJO_LOCAL_DB || path.join(process.cwd(), ".data/tenjo");
  if (localPath) await mkdir(localPath, { recursive: true });
  const db = new PGlite(localPath);
  await db.waitReady;
  return {
    query: (text, values) => db.query(text, values),
    transaction: (work) => db.transaction(work),
    close: () => db.close(),
  };
}

export async function migrate(db: SQL) {
  const schema = await readFile(
    path.join(process.cwd(), "db/schema.sql"),
    "utf8",
  );
  // Each statement is fixed repository SQL, never user input.
  for (const statement of schema
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean))
    await db.query(statement);
}

const globalDB = globalThis as unknown as { tenjoDB?: Promise<Database> };
export function database(): Promise<Database> {
  globalDB.tenjoDB ??= (async () => {
    const db = await makeDatabase(process.env.DATABASE_URL);
    // Hosted schemas are applied explicitly with npm run db:migrate.
    if (!process.env.DATABASE_URL) await migrate(db);
    return db;
  })();
  return globalDB.tenjoDB;
}
