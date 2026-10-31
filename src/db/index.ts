import { mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

// With DATABASE_URL (Render Postgres) we use node-postgres; without it, an embedded
// PGlite database in .data/ so `npm run setup && npm run dev` works with nothing installed.
function connect(): Db {
  const url = process.env.DATABASE_URL;
  if (url) {
    const pool = new Pool({ connectionString: url, max: 5 });
    return drizzlePg({ client: pool, schema }) as unknown as Db;
  }
  const dir = process.env.PGLITE_DIR ?? ".data/pglite";
  if (dir !== "memory://") mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  return drizzlePglite({ client, schema }) as unknown as Db;
}

const globalForDb = globalThis as unknown as { __mealbridgeDb?: Db };

export function getDb(): Db {
  globalForDb.__mealbridgeDb ??= connect();
  return globalForDb.__mealbridgeDb;
}

export async function runMigrations(db: Db = getDb()) {
  const migrationsFolder = "drizzle";
  if (process.env.DATABASE_URL) {
    await migratePg(db as never, { migrationsFolder });
  } else {
    await migratePglite(db as never, { migrationsFolder });
  }
}

export { schema };
