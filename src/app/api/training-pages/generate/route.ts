import { NextResponse } from "next/server";
import { z } from "zod";
import { createOpenAIProvider } from "@/server/ai/provider";
import { generateTrainingPage } from "@/server/training/service";

const generateTrainingPageSchema = z.object({
  userId: z.string().min(1),
  knowledgeItemIds: z.array(z.string().min(1)).optional(),
  shareExpiresAt: z.string().datetime().optional()
});

export async function POST(request: Request) {
  const payload = generateTrainingPageSchema.parse(await request.json());
  const provider = createOpenAIProvider();
  const result = await generateTrainingPage(
    {
      userId: payload.userId,
      knowledgeItemIds: payload.knowledgeItemIds ?? [],
      shareExpiresAt: payload.shareExpiresAt
        ? new Date(payload.shareExpiresAt)
        : undefined
    },
    provider
  );

  return NextResponse.json({
    trainingPage: result.trainingPage,
    shareLink: result.shareLink
  });
}
