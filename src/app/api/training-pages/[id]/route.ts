import { NextResponse } from "next/server";
import { updateTrainingPage, saveVersionSnapshot } from "@/server/training/repository";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { userId, slidesJson, title, totalMinutes, version, restoreInstruction, preRestoreVersion, preRestoreSlidesJson } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId 必填" }, { status: 400 });
    }

    const hasUpdateFields = slidesJson !== undefined || title !== undefined || totalMinutes !== undefined || version !== undefined;
    const isRestore = !!(restoreInstruction && preRestoreVersion && preRestoreSlidesJson);
    if (!hasUpdateFields && !isRestore) {
      return NextResponse.json({ error: "没有提供需要更新的字段" }, { status: 400 });
    }

    // On restore, save the current state as a snapshot so user can undo
    if (restoreInstruction && preRestoreVersion && preRestoreSlidesJson) {
      await saveVersionSnapshot({
        trainingPageId: id,
        version: preRestoreVersion,
        instruction: `v${preRestoreVersion} 恢复前自动保存`,
        slidesJson: preRestoreSlidesJson
      });
    }

    const updateFields: Record<string, unknown> = {
      title: title ?? undefined,
      slidesJson: slidesJson ?? undefined,
      totalMinutes: totalMinutes ?? undefined,
      version: version ?? undefined,
    };
    if (isRestore) {
      updateFields.status = "ready";
    }
    const updated = await updateTrainingPage(id, updateFields as Parameters<typeof updateTrainingPage>[1]);

    if (updated.userId !== userId) {
      return NextResponse.json({ error: "无权修改此培训页" }, { status: 403 });
    }

    // Save the restored version itself as a snapshot
    if (restoreInstruction && version) {
      await saveVersionSnapshot({
        trainingPageId: id,
        version: version,
        instruction: restoreInstruction,
        slidesJson: slidesJson
      });
    }

    return NextResponse.json({
      trainingPage: {
        id: updated.id,
        userId: updated.userId,
        title: updated.title,
        framework: updated.framework,
        slidesJson: updated.slidesJson,
        totalMinutes: updated.totalMinutes,
        version: updated.version,
        status: updated.status,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt
      },
      shareLink: null
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "更新失败" },
      { status: 500 }
    );
  }
}
