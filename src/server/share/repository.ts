import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { recordAuditEvent } from "../audit";
import { getDb } from "../db/client";
import { shareLinks } from "../db/schema";

export type ShareLinkRecord = {
  id: string;
  trainingPageId: string;
  token: string;
  status: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export async function createShareLink(input: {
  trainingPageId: string;
  token: string;
  expiresAt: Date;
}) {
  const now = new Date();
  const record: ShareLinkRecord = {
    id: randomUUID(),
    trainingPageId: input.trainingPageId,
    token: input.token,
    status: "active",
    expiresAt: input.expiresAt,
    createdAt: now,
    updatedAt: now
  };

  const db = await getDb();

  await db.insert(shareLinks).values({
    id: record.id,
    trainingPageId: record.trainingPageId,
    token: record.token,
    status: record.status,
    expiresAt: record.expiresAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  }).run();

  void recordAuditEvent({
    eventType: "share_link_created",
    payload: {
      shareLinkId: record.id,
      trainingPageId: record.trainingPageId,
      token: record.token
    }
  });

  return record;
}

export async function revokeShareLink(id: string) {
  const now = new Date();
  const db = await getDb();

  await db
    .update(shareLinks)
    .set({
      status: "revoked",
      updatedAt: now
    })
    .where(eq(shareLinks.id, id))
    .run();

  const rows = await db.select().from(shareLinks).where(eq(shareLinks.id, id)).all();
  const row = rows[0];

  if (!row) {
    throw new Error(`Share link not found: ${id}`);
  }

  void recordAuditEvent({
    eventType: "share_link_revoked",
    payload: {
      shareLinkId: row.id,
      trainingPageId: row.trainingPageId,
      token: row.token
    }
  });

  return {
    id: row.id,
    trainingPageId: row.trainingPageId,
    token: row.token,
    status: row.status,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}
