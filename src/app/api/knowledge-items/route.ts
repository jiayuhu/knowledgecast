import { NextResponse } from "next/server";
import { z } from "zod";
import { listRecentKnowledgeItems } from "@/server/knowledge/repository";

const listKnowledgeItemsSchema = z.object({
  userId: z.string().min(1),
  limit: z.coerce.number().int().positive().max(20).optional()
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const payload = listKnowledgeItemsSchema.parse({
    userId: url.searchParams.get("userId") ?? "",
    limit: url.searchParams.get("limit") ?? undefined
  });

  const knowledgeItems = await listRecentKnowledgeItems(
    payload.userId,
    payload.limit ?? 5
  );

  return NextResponse.json({ knowledgeItems });
}
