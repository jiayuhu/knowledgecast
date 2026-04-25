import { createClient } from "@libsql/client/node";
import { drizzle } from "drizzle-orm/libsql/node";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { SCHEMA_SQL } from "./schema";

type Db = ReturnType<typeof drizzle>;

let sqliteClient: ReturnType<typeof createClient> | null = null;
let drizzleDb: ReturnType<typeof drizzle> | null = null;
let initPromise: Promise<Db> | null = null;

function resolveDatabasePath(databaseUrl: string) {
  if (databaseUrl.startsWith("file:")) {
    const relativePath = databaseUrl.slice("file:".length);
    return pathToFileURL(path.resolve(relativePath)).href;
  }

  return databaseUrl;
}

async function bootstrapSchema(client: ReturnType<typeof createClient>) {
  for (const statement of SCHEMA_SQL) {
    await client.execute(statement);
  }
}

export function getSqliteClient() {
  if (sqliteClient) {
    return sqliteClient;
  }

  const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";
  const databasePath = resolveDatabasePath(databaseUrl);
  sqliteClient = createClient({ url: databasePath });

  return sqliteClient;
}

async function initializeDatabase() {
  const client = getSqliteClient();
  await bootstrapSchema(client);
  return drizzle({ client });
}

export async function getDb() {
  if (drizzleDb) {
    return drizzleDb;
  }

  if (!initPromise) {
    initPromise = initializeDatabase().then((db) => {
      drizzleDb = db;
      return db;
    });
  }

  drizzleDb = await initPromise;
  return drizzleDb;
}
