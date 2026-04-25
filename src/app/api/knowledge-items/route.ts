import { NextResponse } from "next/server";
import { z } from "zod";
import { storeKnowledgeInput } from "@/server/ingest/storage";

const createKnowledgeItemSchema = z.object({
  userId: z.string().min(1),
  sourceType: z.enum(["text", "url", "markdown", "voice"]),
  content: z.string().min(1),
  title: z.string().nullable().optional()
});

export async function POST(request: Request) {
  const payload = createKnowledgeItemSchema.parse(await request.json());
  const item = await storeKnowledgeInput(payload);

  return NextResponse.json({ item }, { status: 201 });
}
