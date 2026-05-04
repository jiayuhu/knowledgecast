import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { workspaces } from "../db/schema";

export type WorkspaceRecord = {
  id: string;
  userId: string;
  areaId: string | null;
  name: string;
  topic: string | null;
  sortOrder: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function createWorkspace(userId: string, name: string, areaId?: string) {
  const now = new Date();
  const record: WorkspaceRecord = {
    id: randomUUID(),
    userId,
    areaId: areaId ?? null,
    name,
    topic: null,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now
  };

  const db = await getDb();
  await db.insert(workspaces).values(record).run();
  return record;
}

export async function listWorkspaces(userId: string, areaId?: string | null) {
  const db = await getDb();
  const conditions = [eq(workspaces.userId, userId)];
  if (areaId) conditions.push(eq(workspaces.areaId, areaId));

  return db
    .select()
    .from(workspaces)
    .where(and(...conditions))
    .orderBy(asc(workspaces.sortOrder), asc(workspaces.createdAt))
    .all();
}

export async function getWorkspace(id: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, id))
    .all();
  return rows[0] ?? null;
}

export async function updateWorkspace(
  id: string,
  input: { name?: string; topic?: string | null; areaId?: string | null }
) {
  const db = await getDb();
  const now = new Date();
  const values: Record<string, unknown> = { updatedAt: now };
  if (input.name !== undefined) values.name = input.name;
  if (input.topic !== undefined) values.topic = input.topic;
  if (input.areaId !== undefined) values.area_id = input.areaId;
  await db
    .update(workspaces)
    .set(values)
    .where(eq(workspaces.id, id))
    .run();
}

export async function reorderWorkspaces(orderedIds: string[]) {
  const db = await getDb();
  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(workspaces)
      .set({ sortOrder: i })
      .where(eq(workspaces.id, orderedIds[i]))
      .run();
  }
}

export async function deleteWorkspace(id: string) {
  const db = await getDb();
  await db.delete(workspaces).where(eq(workspaces.id, id)).run();
}

export async function ensureDefaultWorkspace(userId: string, areaId?: string) {
  const existing = await listWorkspaces(userId, areaId);
  if (existing.length === 0) {
    return createWorkspace(userId, "默认工作集", areaId);
  }
  return existing[0];
}
