import { NextResponse } from "next/server";
import { z } from "zod";
import { listOrphanedKnowledgeItems } from "@/server/knowledge/repository";
import { listRecentKnowledgeItems } from "@/server/knowledge/repository";
import { storeKnowledgeInput } from "@/server/ingest/storage";

const listKnowledgeItemsSchema = z.object({
  userId: z.string().min(1),
  collectionId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).optional()
});

const createKnowledgeItemSchema = z.object({
  userId: z.string().min(1),
  collectionId: z.string().optional(),
  sourceType: z.enum(["text", "url", "markdown", "voice"]),
  title: z.string().nullable().optional(),
  content: z.string().min(1),
  enrich: z.boolean().optional()
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const orphaned = url.searchParams.get("orphaned") === "true";

  if (orphaned) {
    const userId = url.searchParams.get("userId") ?? "demo-user";
    const items = await listOrphanedKnowledgeItems(userId);
    return NextResponse.json({ knowledgeItems: items });
  }

  const payload = listKnowledgeItemsSchema.parse({
    userId: url.searchParams.get("userId") ?? "",
    collectionId: url.searchParams.get("collectionId") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined
  });

  const knowledgeItems = await listRecentKnowledgeItems(
    payload.userId,
    payload.limit ?? 5,
    payload.collectionId
  );

  return NextResponse.json({ knowledgeItems });
}

export async function POST(request: Request) {
  try {
    const payload = createKnowledgeItemSchema.parse(await request.json());
    const item = await storeKnowledgeInput({
      userId: payload.userId,
      collectionId: payload.collectionId,
      sourceType: payload.sourceType,
      title: payload.title,
      content: payload.content,
      enrich: payload.enrich
    });

    return NextResponse.json({ item });
  } catch (e) {
    const message = e instanceof Error ? e.message : "捕获失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
