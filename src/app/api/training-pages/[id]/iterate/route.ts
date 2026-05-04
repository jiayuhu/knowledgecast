import { NextResponse } from "next/server";
import { z } from "zod";
import { createAIProvider } from "@/server/ai/provider";
import { generateTrainingSlides } from "@/server/training/service";

const iterateSchema = z.object({
  userId: z.string().min(1),
  knowledgeItemIds: z.array(z.string().min(1)),
  frameworkId: z.string().min(1),
  instruction: z.string().min(1)
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const payload = iterateSchema.parse(await request.json());

  const provider = createAIProvider();
  const result = await generateTrainingSlides(
    {
      userId: payload.userId,
      knowledgeItemIds: payload.knowledgeItemIds,
      frameworkId: payload.frameworkId,
      instruction: payload.instruction,
      previousPageId: id
    },
    provider
  );

  return NextResponse.json({
    trainingPage: result.trainingPage,
    shareLink: result.shareLink
  });
}
