import { NextResponse } from "next/server";
import { z } from "zod";
import { updateArea, deleteArea } from "@/server/area/repository";

const updateSchema = z.object({
  name: z.string().min(1).max(50)
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const payload = updateSchema.parse(await request.json());
  await updateArea(id, payload.name);
  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deleteArea(id);
  return NextResponse.json({ success: true });
}
