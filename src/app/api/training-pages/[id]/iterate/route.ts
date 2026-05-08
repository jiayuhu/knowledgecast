import { NextResponse } from "next/server";
import { z } from "zod";
import { getAIProvider } from "@/server/ai/provider";
import { generateTrainingSlides } from "@/server/training/service";

const iterateSchema = z.object({
  userId: z.string().min(1),
  collectionId: z.string().nullable().optional(),
  knowledgeItemIds: z.array(z.string().min(1)),
  frameworkId: z.string().min(1),
  instruction: z.string().min(1)
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const payload = iterateSchema.parse(await request.json());

    const provider = await getAIProvider();
    const result = await generateTrainingSlides(
      {
        userId: payload.userId,
        collectionId: payload.collectionId,
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
  } catch (e) {
    const message = e instanceof Error ? e.message : "调整失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
