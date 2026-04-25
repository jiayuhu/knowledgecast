import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { trainingPages } from "../db/schema";

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
