import { NextResponse } from "next/server";
import { z } from "zod";
import { listRecentTrainingPages } from "@/server/training/repository";

const listTrainingPagesSchema = z.object({
  userId: z.string().min(1),
  limit: z.coerce.number().int().positive().max(200).optional()
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const payload = listTrainingPagesSchema.parse({
    userId: url.searchParams.get("userId") ?? "",
    limit: url.searchParams.get("limit") ?? undefined
  });

  const trainingPages = await listRecentTrainingPages(
    payload.userId,
    payload.limit ?? 5
  );

  return NextResponse.json({ trainingPages });
}
