import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { collections, knowledgeItems } from "../db/schema";

export type CollectionRecord = {
  id: string;
  userId: string;
  areaId: string | null;
  name: string;
  topic: string | null;
  phase: string;
  sortOrder: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function createCollection(userId: string, name: string, areaId?: string) {
  const now = new Date();
  const db = await getDb();

  const existing = await listCollections(userId, areaId);
  const maxOrder = existing.reduce((max, collection) => Math.max(max, collection.sortOrder ?? 0), -1);

  const record: CollectionRecord = {
    id: randomUUID(),
    userId,
    areaId: areaId ?? null,
    name,
    topic: null,
    phase: "capture",
    sortOrder: maxOrder + 1,
    createdAt: now,
    updatedAt: now
  };

  await db.insert(collections).values(record).run();
  return record;
}

export async function listCollections(userId: string, areaId?: string | null) {
  const db = await getDb();
  const conditions = [eq(collections.userId, userId)];
  if (areaId) conditions.push(eq(collections.areaId, areaId));

  return db
    .select()
    .from(collections)
    .where(and(...conditions))
    .orderBy(asc(collections.sortOrder), asc(collections.createdAt))
    .all();
}

export async function getCollection(id: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(collections)
    .where(eq(collections.id, id))
    .all();
  return rows[0] ?? null;
}

export async function updateCollection(
  id: string,
  input: { name?: string; topic?: string | null; areaId?: string | null; phase?: string }
) {
  const db = await getDb();
  const now = new Date();
  const values: Record<string, unknown> = { updatedAt: now };
  if (input.name !== undefined) values.name = input.name;
  if (input.topic !== undefined) values.topic = input.topic;
  if (input.areaId !== undefined) values.areaId = input.areaId;
  if (input.phase !== undefined) values.phase = input.phase;
  await db
    .update(collections)
    .set(values)
    .where(eq(collections.id, id))
    .run();
}

export async function reorderCollections(orderedIds: string[]) {
  const db = await getDb();
  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(collections)
      .set({ sortOrder: i })
      .where(eq(collections.id, orderedIds[i]))
      .run();
  }
}

export async function deleteCollection(id: string) {
  const db = await getDb();
  await db
    .update(knowledgeItems)
    .set({ collectionId: null })
    .where(eq(knowledgeItems.collectionId, id))
    .run();
  await db.delete(collections).where(eq(collections.id, id)).run();
}

export async function ensureDefaultCollection(userId: string, areaId?: string) {
  const existing = await listCollections(userId, areaId);
  if (existing.length === 0) {
    return createCollection(userId, "默认工作集", areaId);
  }
  return existing[0];
}
