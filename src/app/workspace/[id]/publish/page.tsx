"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ActionTabs } from "@/components/workspace/ActionTabs";
import Link from "next/link";

type Workspace = { id: string; name: string; areaId?: string | null };
type TrainingPageItem = {
  id: string; title: string; framework: string | null; totalMinutes: number | null;
  version: number | null; status: string; createdAt: string;
  shareLink: { token: string; status: string; expiresAt: string } | null;
};

export default function PublishPage() {
  const { id } = useParams<{ id: string }>();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [areaName, setAreaName] = useState("");
  const [pages, setPages] = useState<TrainingPageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/workspaces?userId=demo-user"),
      fetch("/api/areas?userId=demo-user")
    ]).then(async ([wsRes, areaRes]) => {
      const wsData = await wsRes.json();
      const areaData = await areaRes.json();
      const ws = (wsData.workspaces as Workspace[]).find((w) => w.id === id);
      setWorkspace(ws ?? null);
      if (ws?.areaId) {
        const area = (areaData.areas as { id: string; name: string }[]).find((a) => a.id === ws.areaId);
        setAreaName(area?.name ?? "");
      }
    });

    fetch("/api/training-pages?userId=demo-user&limit=50")
      .then((r) => r.json())
      .then((data) => setPages((data.trainingPages ?? []) as TrainingPageItem[]))
      .finally(() => setLoading(false));
  }, [id]);

  async function copyLink(token: string) {
    await navigator.clipboard.writeText(`${window.location.origin}/share/${token}?preview=1`);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  }

  if (loading) return <main className="px-8 py-8"><p className="text-sm text-gray-400">加载中...</p></main>;

  return (
    <main className="px-8 py-8">
      {workspace && <ActionTabs workspaceId={id} workspaceName={workspace.name} areaName={areaName} />}
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-2">发布培训页</h1>
      <p className="text-sm text-gray-500 mb-6">管理已生成的培训页，复制链接或预览</p>
      {pages.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <div className="text-3xl mb-3">📤</div>
          <p className="text-sm text-gray-500">还没有培训页</p>
          <p className="mt-1 text-xs text-gray-400 mb-4">在整理页选择素材和框架，让 AI 生成培训幻灯片</p>
          <Link href={`/workspace/${id}/structure`} className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">去整理页生成</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {pages.map((tp) => (
            <div key={tp.id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-gray-900 truncate">{tp.title}</h3>
                <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
                  {tp.framework && <span>框架：{tp.framework}</span>}
                  {tp.totalMinutes && <span>{tp.totalMinutes} 分钟</span>}
                  <span>V{tp.version ?? 1}</span>
                  <span>{new Date(tp.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                {tp.shareLink && (
                  <>
                    <button onClick={() => copyLink(tp.shareLink!.token)}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition">
                      {copiedToken === tp.shareLink.token ? "已复制 ✓" : "复制链接"}
                    </button>
                    <a href={`/share/${tp.shareLink.token}?preview=1`} target="_blank" rel="noopener noreferrer"
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition">预览</a>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
