import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { describe, expect, it } from "vitest";

describe("collections migration", () => {
  it("renames workspace tables and preserves existing rows", async () => {
    const client = createClient({ url: ":memory:" });

    await client.execute(`
      CREATE TABLE workspaces (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        user_id TEXT NOT NULL,
        area_id TEXT,
        topic TEXT,
        sort_order INTEGER DEFAULT 0 NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);
    await client.execute(`
      CREATE TABLE knowledge_items (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        workspace_id TEXT,
        source_type TEXT NOT NULL,
        title TEXT,
        content TEXT NOT NULL,
        metadata_json TEXT,
        status TEXT DEFAULT 'active' NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);

    await client.execute({
      sql: `
        INSERT INTO workspaces (id, name, user_id, area_id, topic, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      args: ["workspace_1", "销售培训", "user_1", "area_1", "入职培训", 7]
    });
    await client.execute({
      sql: `
        INSERT INTO knowledge_items (id, user_id, workspace_id, source_type, title, content)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      args: ["item_1", "user_1", "workspace_1", "text", "素材", "内容"]
    });

    const migration = readFileSync(
      path.join(process.cwd(), "drizzle/0008_collections_migration.sql"),
      "utf8"
    );
    for (const statement of migration.split("--> statement-breakpoint")) {
      const sql = statement.trim();
      if (sql) await client.execute(sql);
    }

    const collectionRows = await client.execute("SELECT id, name, user_id, area_id, topic, sort_order FROM collections");
    expect(collectionRows.rows).toEqual([
      {
        id: "workspace_1",
        name: "销售培训",
        user_id: "user_1",
        area_id: "area_1",
        topic: "入职培训",
        sort_order: 7
      }
    ]);

    const itemRows = await client.execute("SELECT id, collection_id FROM knowledge_items");
    expect(itemRows.rows).toEqual([{ id: "item_1", collection_id: "workspace_1" }]);

    const oldTable = await client.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'workspaces'");
    expect(oldTable.rows).toHaveLength(0);

    const columns = await client.execute("PRAGMA table_info(knowledge_items)");
    expect(columns.rows.map((row) => row.name)).toContain("collection_id");
    expect(columns.rows.map((row) => row.name)).not.toContain("workspace_id");
  });

  it("adds collection ownership to training pages without dropping existing pages", async () => {
    const client = createClient({ url: ":memory:" });

    await client.execute(`
      CREATE TABLE training_pages (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        framework TEXT,
        outline_json TEXT,
        content_json TEXT,
        slides_json TEXT,
        total_minutes INTEGER,
        version INTEGER DEFAULT 1,
        status TEXT DEFAULT 'ready' NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
    await client.execute({
      sql: `
        INSERT INTO training_pages (id, user_id, title, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      args: ["page_1", "user_1", "Existing Training", "ready", 1, 1]
    });

    const migration = readFileSync(
      path.join(process.cwd(), "drizzle/0009_training_pages_collection.sql"),
      "utf8"
    );
    await client.execute(migration.trim());

    const rows = await client.execute("SELECT id, title, collection_id FROM training_pages");
    expect(rows.rows).toEqual([
      { id: "page_1", title: "Existing Training", collection_id: null }
    ]);
  });
});
