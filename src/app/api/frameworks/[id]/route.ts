import { NextResponse } from "next/server";
import { z } from "zod";
import { updateUserFramework, deleteUserFramework } from "@/server/training/frameworks";

const updateSchema = z.object({
  name: z.string().min(1).max(30).optional(),
  structure: z.array(z.string().min(1)).min(1).max(10).optional(),
  description: z.string().nullable().optional()
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const payload = updateSchema.parse(await request.json());
  await updateUserFramework(id, payload);
  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deleteUserFramework(id);
  return NextResponse.json({ success: true });
}
