import { NextResponse } from "next/server";
import { getVersionSnapshot } from "@/server/training/repository";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const { versionId } = await params;
  try {
    const snapshot = await getVersionSnapshot(versionId);
    if (!snapshot) {
      return NextResponse.json({ error: "版本不存在" }, { status: 404 });
    }
    return NextResponse.json({
      id: snapshot.id,
      slidesJson: snapshot.slidesJson,
      version: snapshot.version,
      instruction: snapshot.instruction,
      createdAt: snapshot.createdAt
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "获取版本失败" },
      { status: 500 }
    );
  }
}
