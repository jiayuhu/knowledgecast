import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "../db/client";
import { knowledgeItems } from "../db/schema";

export type KnowledgeItemRecord = {
  id: string;
  userId: string;
  collectionId: string | null;
  sourceType: string;
  title: string | null;
  content: string;
  originalUrl: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export async function createKnowledgeItem(input: {
  userId: string;
  collectionId?: string | null;
  sourceType: string;
  title?: string | null;
  content: string;
  originalUrl?: string | null;
}) {
  const now = new Date();
  const record: KnowledgeItemRecord = {
    id: randomUUID(),
    userId: input.userId,
    collectionId: input.collectionId ?? null,
    sourceType: input.sourceType,
    title: input.title ?? null,
    content: input.content,
    originalUrl: input.originalUrl ?? null,
    status: "draft",
    createdAt: now,
    updatedAt: now
  };

  const db = await getDb();
  await db.insert(knowledgeItems).values(record).run();
  return record;
}

export async function updateKnowledgeItem(
  id: string,
  userId: string,
  input: { title?: string | null; content?: string; collectionId?: string | null }
) {
  const db = await getDb();
  const now = new Date();
  const values: Record<string, unknown> = { updatedAt: now };

  if (input.title !== undefined) values.title = input.title;
  if (input.content !== undefined) values.content = input.content;
  if (input.collectionId !== undefined) values.collectionId = input.collectionId;

  await db
    .update(knowledgeItems)
    .set(values)
    .where(and(eq(knowledgeItems.id, id), eq(knowledgeItems.userId, userId)))
    .run();

  const rows = await db
    .select()
    .from(knowledgeItems)
    .where(and(eq(knowledgeItems.id, id), eq(knowledgeItems.userId, userId)))
    .all();
  return rows[0] ?? null;
}

export async function deleteKnowledgeItem(id: string, userId: string) {
  const db = await getDb();
  // 删除前读内容，供图片清理兜底
  const rows = await db
    .select({ content: knowledgeItems.content })
    .from(knowledgeItems)
    .where(and(eq(knowledgeItems.id, id), eq(knowledgeItems.userId, userId)))
    .all();

  await db
    .delete(knowledgeItems)
    .where(and(eq(knowledgeItems.id, id), eq(knowledgeItems.userId, userId)))
    .run();

  return rows[0]?.content ?? null;
}

export async function archiveKnowledgeItem(id: string, userId: string) {
  const db = await getDb();
  const now = new Date();

  await db
    .update(knowledgeItems)
    .set({
      status: "archived",
      updatedAt: now
    })
    .where(and(eq(knowledgeItems.id, id), eq(knowledgeItems.userId, userId)))
    .run();

  const rows = await db
    .select()
    .from(knowledgeItems)
    .where(and(eq(knowledgeItems.id, id), eq(knowledgeItems.userId, userId)))
    .all();
  const row = rows[0];

  if (!row) {
    throw new Error(`Knowledge item not found: ${id}`);
  }

  return {
    id: row.id,
    userId: row.userId,
    collectionId: row.collectionId,
    sourceType: row.sourceType,
    title: row.title,
    content: row.content,
    originalUrl: row.originalUrl,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export async function listKnowledgeItems(
  userId: string,
  collectionId?: string | null
) {
  const db = await getDb();
  const conditions = [eq(knowledgeItems.userId, userId)];
  if (collectionId) {
    conditions.push(eq(knowledgeItems.collectionId, collectionId));
  }
  const rows = await db
    .select()
    .from(knowledgeItems)
    .where(and(...conditions))
    .all();
  return rows;
}

export async function listRecentKnowledgeItems(
  userId: string,
  limit = 5,
  collectionId?: string | null
) {
  const db = await getDb();
  const conditions = [eq(knowledgeItems.userId, userId)];
  if (collectionId) {
    conditions.push(eq(knowledgeItems.collectionId, collectionId));
  }
  const rows = await db
    .select()
    .from(knowledgeItems)
    .where(and(...conditions))
    .orderBy(desc(knowledgeItems.createdAt))
    .limit(limit)
    .all();

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    collectionId: row.collectionId,
    sourceType: row.sourceType,
    title: row.title,
    content: row.content,
    originalUrl: row.originalUrl,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }));
}

export async function listOrphanedKnowledgeItems(userId: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(knowledgeItems)
    .where(and(eq(knowledgeItems.userId, userId), isNull(knowledgeItems.collectionId)))
    .orderBy(desc(knowledgeItems.createdAt))
    .all();

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    collectionId: row.collectionId,
    sourceType: row.sourceType,
    title: row.title,
    content: row.content,
    originalUrl: row.originalUrl,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }));
}
