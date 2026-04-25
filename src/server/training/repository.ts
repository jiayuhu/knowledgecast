import { randomUUID } from "node:crypto";
import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../db/client";
import { shareLinks, trainingPages } from "../db/schema";

export type TrainingPageRecord = {
  id: string;
  userId: string;
  title: string;
  outlineJson: string;
  contentJson: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export async function createTrainingPage(input: {
  userId: string;
  title: string;
  outline: string[];
  content: string[];
  status?: string;
}) {
  const now = new Date();
  const record: TrainingPageRecord = {
    id: randomUUID(),
    userId: input.userId,
    title: input.title,
    outlineJson: JSON.stringify(input.outline),
    contentJson: JSON.stringify(input.content),
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
  input: Partial<Pick<TrainingPageRecord, "title" | "status">> & {
    outline?: string[];
    content?: string[];
  }
) {
  const db = await getDb();
  const now = new Date();
  const updateValues: Partial<TrainingPageRecord> = {
    updatedAt: now
  };

  if (input.title !== undefined) {
    updateValues.title = input.title;
  }

  if (input.status !== undefined) {
    updateValues.status = input.status;
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

export async function listRecentTrainingPages(userId: string, limit = 5) {
  const db = await getDb();
  const pages = await db
    .select()
    .from(trainingPages)
    .where(eq(trainingPages.userId, userId))
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
      title: page.title,
      outline: JSON.parse(page.outlineJson) as string[],
      content: JSON.parse(page.contentJson) as string[],
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
