import { NextResponse } from "next/server";
import { z } from "zod";
import { createArea, listAreas, reorderAreas } from "@/server/area/repository";

const createAreaSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1).max(50)
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId") ?? "demo-user";

  let areas = await listAreas(userId);
  if (areas.length === 0) {
    const defaultArea = await createArea(userId, "默认");
    areas = [defaultArea];
  }

  return NextResponse.json({ areas });
}

const reorderSchema = z.object({
  orderedIds: z.array(z.string().min(1))
});

export async function PUT(request: Request) {
  const payload = reorderSchema.parse(await request.json());
  await reorderAreas(payload.orderedIds);
  return NextResponse.json({ success: true });
}

export async function POST(request: Request) {
  const payload = createAreaSchema.parse(await request.json());
  const area = await createArea(payload.userId, payload.name);
  return NextResponse.json({ area });
}
