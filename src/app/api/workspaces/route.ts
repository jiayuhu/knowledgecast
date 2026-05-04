import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createWorkspace,
  listWorkspaces,
  reorderWorkspaces
} from "@/server/workspace/repository";
import { ensureDefaultArea } from "@/server/area/repository";

const createWorkspaceSchema = z.object({
  userId: z.string().min(1),
  areaId: z.string().optional(),
  name: z.string().min(1).max(50)
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId") ?? "demo-user";
  const areaId = url.searchParams.get("areaId") ?? undefined;

  let workspaces = await listWorkspaces(userId, areaId);
  if (workspaces.length === 0) {
    // 确保默认工作区存在
    const area = areaId ? { id: areaId } : await ensureDefaultArea(userId);
    const defaultWs = await createWorkspace(userId, "默认工作集", area.id);
    workspaces = [defaultWs];
  }

  return NextResponse.json({ workspaces });
}

const reorderSchema = z.object({
  orderedIds: z.array(z.string().min(1))
});

export async function PUT(request: Request) {
  const payload = reorderSchema.parse(await request.json());
  await reorderWorkspaces(payload.orderedIds);
  return NextResponse.json({ success: true });
}

export async function POST(request: Request) {
  const payload = createWorkspaceSchema.parse(await request.json());
  const workspace = await createWorkspace(payload.userId, payload.name, payload.areaId);
  return NextResponse.json({ workspace });
}
