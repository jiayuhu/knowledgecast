import { NextResponse } from "next/server";
import { z } from "zod";
import { getAIProvider } from "@/server/ai/provider";
import { generateTrainingSlides } from "@/server/training/service";

const generateSlidesSchema = z.object({
  userId: z.string().min(1),
  knowledgeItemIds: z.array(z.string().min(1)).optional(),
  frameworkId: z.string().min(1),
  topic: z.string().optional(),
  instruction: z.string().optional(),
  previousPageId: z.string().optional()
});

export async function POST(request: Request) {
  const payload = generateSlidesSchema.parse(await request.json());
  const provider = await getAIProvider();
  const result = await generateTrainingSlides(
    {
      userId: payload.userId,
      knowledgeItemIds: payload.knowledgeItemIds ?? [],
      frameworkId: payload.frameworkId,
      topic: payload.topic,
      instruction: payload.instruction,
      previousPageId: payload.previousPageId
    },
    provider
  );

  return NextResponse.json({
    trainingPage: result.trainingPage,
    shareLink: result.shareLink
  });
}
