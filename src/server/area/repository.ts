import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { areas } from "../db/schema";

export type AreaRecord = {
  id: string;
  userId: string;
  name: string;
  sortOrder: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function createArea(userId: string, name: string) {
  const now = new Date();
  const record: AreaRecord = {
    id: randomUUID(),
    userId,
    name,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now
  };

  const db = await getDb();
  await db.insert(areas).values(record).run();
  return record;
}

export async function listAreas(userId: string) {
  const db = await getDb();
  return db
    .select()
    .from(areas)
    .where(eq(areas.userId, userId))
    .orderBy(asc(areas.sortOrder), asc(areas.createdAt))
    .all();
}

export async function updateArea(id: string, name: string) {
  const db = await getDb();
  const now = new Date();
  await db
    .update(areas)
    .set({ name, updatedAt: now })
    .where(eq(areas.id, id))
    .run();
}

export async function reorderAreas(orderedIds: string[]) {
  const db = await getDb();
  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(areas)
      .set({ sortOrder: i })
      .where(eq(areas.id, orderedIds[i]))
      .run();
  }
}

export async function deleteArea(id: string) {
  const db = await getDb();
  await db.delete(areas).where(eq(areas.id, id)).run();
}

export async function ensureDefaultArea(userId: string) {
  const existing = await listAreas(userId);
  if (existing.length === 0) {
    return createArea(userId, "默认");
  }
  return existing[0];
}
