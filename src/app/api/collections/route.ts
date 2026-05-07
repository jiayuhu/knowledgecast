import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createCollection,
  listCollections,
  reorderCollections
} from "@/server/collection/repository";
import { ensureDefaultArea } from "@/server/area/repository";

const createCollectionSchema = z.object({
  userId: z.string().min(1),
  areaId: z.string().optional(),
  name: z.string().min(1).max(50)
});

const reorderSchema = z.object({
  orderedIds: z.array(z.string().min(1))
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId") ?? "demo-user";
  const areaId = url.searchParams.get("areaId") ?? undefined;

  let collections = await listCollections(userId, areaId);
  if (collections.length === 0) {
    const area = areaId ? { id: areaId } : await ensureDefaultArea(userId);
    const defaultCollection = await createCollection(userId, "默认工作集", area.id);
    collections = [defaultCollection];
  }

  return NextResponse.json({ collections });
}

export async function PUT(request: Request) {
  const payload = reorderSchema.parse(await request.json());
  await reorderCollections(payload.orderedIds);
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const payload = createCollectionSchema.parse(await request.json());
  const collection = await createCollection(payload.userId, payload.name, payload.areaId);
  return NextResponse.json({ collection });
}
