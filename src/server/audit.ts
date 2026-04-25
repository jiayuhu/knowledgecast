import { randomUUID } from "node:crypto";
import { getDb } from "./db/client";
import { auditLogs } from "./db/schema";

export async function recordAuditEvent(input: {
  eventType: string;
  payload: Record<string, unknown>;
  actorEmail?: string | null;
}) {
  const db = await getDb();
  const now = new Date();
  const entry = {
    id: randomUUID(),
    actorEmail: input.actorEmail ?? null,
    eventType: input.eventType,
    payloadJson: JSON.stringify(input.payload),
    createdAt: now
  };

  await db.insert(auditLogs).values(entry).run();
  return entry;
}
