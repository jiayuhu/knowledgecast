import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../db/client";
import { iterationHistory, shareLinks, trainingPages } from "../db/schema";

export type TrainingPageRecord = {
  id: string;
  userId: string;
  collectionId: string | null;
  title: string;
  framework: string | null;
  outlineJson: string | null;
  contentJson: string | null;
  slidesJson: string | null;
  totalMinutes: number | null;
  version: number | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export async function createTrainingPage(input: {
  userId: string;
  collectionId?: string | null;
  title: string;
  outline?: string[];
  content?: string[];
  slidesJson?: string;
  framework?: string;
  totalMinutes?: number;
  status?: string;
}) {
  const now = new Date();
  const record: TrainingPageRecord = {
    id: randomUUID(),
    userId: input.userId,
    collectionId: input.collectionId ?? null,
    title: input.title,
    framework: input.framework ?? null,
    outlineJson: input.outline ? JSON.stringify(input.outline) : null,
    contentJson: input.content ? JSON.stringify(input.content) : null,
    slidesJson: input.slidesJson ?? null,
    totalMinutes: input.totalMinutes ?? null,
    version: 1,
    status: input.status ?? "ready",
    createdAt: now,
    updatedAt: now
  };

  const db = await getDb();
  await db.insert(trainingPages).values(record).run();
  return record;
}

export async function updateTrainingPage(
  id: string,
  input: Partial<Pick<TrainingPageRecord, "title" | "status" | "framework" | "slidesJson" | "totalMinutes" | "version" | "collectionId">> & {
    outline?: string[];
    content?: string[];
  }
) {
  const db = await getDb();
  const now = new Date();
  const updateValues: Record<string, unknown> = {
    updatedAt: now
  };

  if (input.title !== undefined) {
    updateValues.title = input.title;
  }

  if (input.collectionId !== undefined) {
    updateValues.collectionId = input.collectionId;
  }

  if (input.status !== undefined) {
    updateValues.status = input.status;
  }

  if (input.framework !== undefined) {
    updateValues.framework = input.framework;
  }

  if (input.slidesJson !== undefined) {
    updateValues.slidesJson = input.slidesJson;
  }

  if (input.totalMinutes !== undefined) {
    updateValues.totalMinutes = input.totalMinutes;
  }

  if (input.version !== undefined) {
    updateValues.version = input.version;
  }

  if (input.outline !== undefined) {
    updateValues.outlineJson = JSON.stringify(input.outline);
  }

  if (input.content !== undefined) {
    updateValues.contentJson = JSON.stringify(input.content);
  }

  await db.update(trainingPages).set(updateValues).where(eq(trainingPages.id, id)).run();

  const rows = await db.select().from(trainingPages).where(eq(trainingPages.id, id)).all();
  const row = rows[0];

  if (!row) {
    throw new Error(`Training page not found: ${id}`);
  }

  return row;
}

export async function listRecentTrainingPages(userId: string, limit = 5, collectionId?: string | null) {
  const db = await getDb();
  const conditions = [eq(trainingPages.userId, userId)];
  if (collectionId) {
    conditions.push(eq(trainingPages.collectionId, collectionId));
  }

  const pages = await db
    .select()
    .from(trainingPages)
    .where(and(...conditions))
    .orderBy(desc(trainingPages.createdAt))
    .limit(limit)
    .all();

  const pageIds = pages.map((page) => page.id);
  const links = pageIds.length > 0
    ? await db
        .select()
        .from(shareLinks)
        .where(inArray(shareLinks.trainingPageId, pageIds))
        .all()
    : [];

  return pages.map((page) => {
    const link = links.find((item) => item.trainingPageId === page.id) ?? null;

    return {
      id: page.id,
      userId: page.userId,
      collectionId: page.collectionId,
      title: page.title,
      framework: page.framework,
      outline: JSON.parse(page.outlineJson ?? "[]") as string[],
      content: JSON.parse(page.contentJson ?? "[]") as string[],
      slidesJson: page.slidesJson,
      totalMinutes: page.totalMinutes,
      version: page.version,
      status: page.status,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
      shareLink: link
        ? {
            id: link.id,
            token: link.token,
            status: link.status,
            expiresAt: link.expiresAt
          }
        : null
    };
  });
}

export async function getTrainingPageByIdForUser(id: string, userId: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(trainingPages)
    .where(and(eq(trainingPages.id, id), eq(trainingPages.userId, userId)))
    .limit(1)
    .all();
  return rows[0] ?? null;
}

export async function saveVersionSnapshot(input: {
  trainingPageId: string;
  version: number;
  instruction: string;
  slidesJson: string;
}) {
  const db = await getDb();
  await db.insert(iterationHistory).values({
    id: randomUUID(),
    trainingPageId: input.trainingPageId,
    version: input.version,
    instruction: input.instruction,
    slidesJson: input.slidesJson,
    createdAt: new Date()
  }).run();
}

export async function listVersions(trainingPageId: string) {
  const db = await getDb();
  const rows = await db
    .select({
      id: iterationHistory.id,
      version: iterationHistory.version,
      instruction: iterationHistory.instruction,
      createdAt: iterationHistory.createdAt
    })
    .from(iterationHistory)
    .where(eq(iterationHistory.trainingPageId, trainingPageId))
    .orderBy(asc(iterationHistory.version))
    .all();

  return rows;
}

export async function getVersionSnapshot(id: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(iterationHistory)
    .where(eq(iterationHistory.id, id))
    .all();
  return rows[0] ?? null;
}
