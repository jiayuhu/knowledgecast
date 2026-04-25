import { NextResponse } from "next/server";
import { z } from "zod";
import { archiveKnowledgeItem } from "@/server/knowledge/repository";

const archiveKnowledgeItemSchema = z.object({
  userId: z.string().min(1)
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const payload = archiveKnowledgeItemSchema.parse(await request.json());

  const item = await archiveKnowledgeItem(id, payload.userId);

  return NextResponse.json({ item });
}
