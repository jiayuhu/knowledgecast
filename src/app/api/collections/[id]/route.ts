import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteCollection, updateCollection } from "@/server/collection/repository";

const updateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  topic: z.string().nullable().optional(),
  areaId: z.string().nullable().optional(),
  phase: z.enum(["capture", "organize", "create", "publish", "iterate"]).optional()
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const payload = updateSchema.parse(await request.json());
  await updateCollection(id, payload);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deleteCollection(id);
  return NextResponse.json({ ok: true });
}
