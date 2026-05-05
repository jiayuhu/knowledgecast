import { NextResponse } from "next/server";
import { listVersions } from "@/server/training/repository";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const versions = await listVersions(id);
    return NextResponse.json({ versions });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "获取版本列表失败" },
      { status: 500 }
    );
  }
}
