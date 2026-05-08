import { NextResponse } from "next/server";
import { z } from "zod";
import { getAIProvider } from "@/server/ai/provider";
import { generateTrainingSlides } from "@/server/training/service";

const generateSlidesSchema = z.object({
  userId: z.string().min(1),
  collectionId: z.string().nullable().optional(),
  knowledgeItemIds: z.array(z.string().min(1)).optional(),
  frameworkId: z.string().min(1),
  topic: z.string().optional(),
  instruction: z.string().optional(),
  previousPageId: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const payload = generateSlidesSchema.parse(await request.json());
    const provider = await getAIProvider();
    const result = await generateTrainingSlides(
      {
        userId: payload.userId,
        collectionId: payload.collectionId,
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
  } catch (e) {
    const message = e instanceof Error ? e.message : "生成失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
