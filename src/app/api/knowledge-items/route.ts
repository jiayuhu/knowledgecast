import { NextResponse } from "next/server";
import { z } from "zod";
import { listRecentKnowledgeItems, createKnowledgeItem } from "@/server/knowledge/repository";

const listKnowledgeItemsSchema = z.object({
  userId: z.string().min(1),
  workspaceId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).optional()
});

const createKnowledgeItemSchema = z.object({
  userId: z.string().min(1),
  workspaceId: z.string().optional(),
  sourceType: z.enum(["text", "url", "markdown", "voice"]),
  title: z.string().nullable().optional(),
  content: z.string().min(1)
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const payload = listKnowledgeItemsSchema.parse({
    userId: url.searchParams.get("userId") ?? "",
    workspaceId: url.searchParams.get("workspaceId") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined
  });

  const knowledgeItems = await listRecentKnowledgeItems(
    payload.userId,
    payload.limit ?? 5,
    payload.workspaceId
  );

  return NextResponse.json({ knowledgeItems });
}

export async function POST(request: Request) {
  const payload = createKnowledgeItemSchema.parse(await request.json());
  const item = await createKnowledgeItem({
    userId: payload.userId,
    workspaceId: payload.workspaceId,
    sourceType: payload.sourceType,
    title: payload.title,
    content: payload.content
  });

  return NextResponse.json({ item });
}
