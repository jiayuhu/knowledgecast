import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const areas = sqliteTable("areas", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  areaId: text("area_id"),
  name: text("name").notNull(),
  topic: text("topic"),
  sortOrder: integer("sort_order").default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});

export const knowledgeItems = sqliteTable("knowledge_items", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  workspaceId: text("workspace_id"),
  sourceType: text("source_type").notNull(),
  title: text("title"),
  content: text("content").notNull(),
  originalUrl: text("original_url"),
  status: text("status").notNull().default("draft"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});

export const trainingPages = sqliteTable("training_pages", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  framework: text("framework"),
  outlineJson: text("outline_json"),
  contentJson: text("content_json"),
  slidesJson: text("slides_json"),
  totalMinutes: integer("total_minutes"),
  version: integer("version").default(1),
  status: text("status").notNull().default("ready"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});

export const shareLinks = sqliteTable("share_links", {
  id: text("id").primaryKey(),
  trainingPageId: text("training_page_id").notNull(),
  token: text("token").notNull().unique(),
  status: text("status").notNull().default("active"),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});

export const accessTokens = sqliteTable("access_tokens", {
  id: text("id").primaryKey(),
  shareLinkId: text("share_link_id").notNull(),
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull()
});

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  actorEmail: text("actor_email"),
  eventType: text("event_type").notNull(),
  payloadJson: text("payload_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull()
});

export const userFrameworks = sqliteTable("user_frameworks", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  structureJson: text("structure_json").notNull(),
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});

export const iterationHistory = sqliteTable("iteration_history", {
  id: text("id").primaryKey(),
  trainingPageId: text("training_page_id").notNull(),
  version: integer("version").notNull(),
  instruction: text("instruction").notNull(),
  slidesJson: text("slides_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull()
});
// 数据库 schema 由 Drizzle ORM migration 系统管理。
// 运行 `npx drizzle-kit generate` 生成 migration。
// 运行 `npx drizzle-kit migrate` 或启动服务自动执行。
