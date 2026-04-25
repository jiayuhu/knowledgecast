import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { knowledgeItems } from "../db/schema";

export type KnowledgeItemRecord = {
  id: string;
  userId: string;
  sourceType: string;
  title: string | null;
  content: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export async function createKnowledgeItem(input: {
  userId: string;
  sourceType: string;
  title?: string | null;
  content: string;
}) {
  const now = new Date();
  const record: KnowledgeItemRecord = {
    id: randomUUID(),
    userId: input.userId,
    sourceType: input.sourceType,
    title: input.title ?? null,
    content: input.content,
    status: "draft",
    createdAt: now,
    updatedAt: now
  };

  const db = await getDb();
  await db.insert(knowledgeItems).values(record).run();
  return record;
}

export async function listKnowledgeItems(userId: string) {
  const db = await getDb();
  const rows = await db.select().from(knowledgeItems).where(eq(knowledgeItems.userId, userId)).all();
  return rows;
}

export async function listRecentKnowledgeItems(userId: string, limit = 5) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(knowledgeItems)
    .where(eq(knowledgeItems.userId, userId))
    .orderBy(desc(knowledgeItems.createdAt))
    .limit(limit)
    .all();

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    sourceType: row.sourceType,
    title: row.title,
    content: row.content,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }));
}
