import { NextResponse } from "next/server";
import { z } from "zod";
import { updateWorkspace, deleteWorkspace } from "@/server/workspace/repository";

const updateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  topic: z.string().nullable().optional(),
  areaId: z.string().nullable().optional()
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const payload = updateSchema.parse(await request.json());
  await updateWorkspace(id, payload);
  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deleteWorkspace(id);
  return NextResponse.json({ success: true });
}
