import { NextResponse } from "next/server";
import { z } from "zod";
import { archiveKnowledgeItem, deleteKnowledgeItem, updateKnowledgeItem } from "@/server/knowledge/repository";
import { cleanupOrphanImages } from "@/server/knowledge/image-cleanup";

const updateKnowledgeItemSchema = z.object({
  userId: z.string().min(1),
  title: z.string().nullable().optional(),
  content: z.string().min(1).optional(),
  workspaceId: z.string().nullable().optional(),
});

const deleteSchema = z.object({
  userId: z.string().min(1)
});

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const payload = deleteSchema.parse(await request.json());
  const deletedContent = await deleteKnowledgeItem(id, payload.userId);
  // 等待图片清理完成（优先 image_refs 表，兜底内容扫描）
  await cleanupOrphanImages(id, deletedContent);
  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const payload = updateKnowledgeItemSchema.parse(await request.json());

  // 如果只有 userId（无其他字段），执行归档
  if (payload.title === undefined && payload.content === undefined && payload.workspaceId === undefined) {
    const item = await archiveKnowledgeItem(id, payload.userId);
    return NextResponse.json({ item });
  }

  // 更新标题、内容或所属工作集
  const item = await updateKnowledgeItem(id, payload.userId, {
    title: payload.title,
    content: payload.content,
    workspaceId: payload.workspaceId,
  });

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ item });
}
