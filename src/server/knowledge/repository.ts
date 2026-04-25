import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
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
