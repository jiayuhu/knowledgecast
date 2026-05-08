"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type Collection = { id: string; name: string; areaId: string | null; topic?: string | null; userId: string };
type TrainingPageItem = {
  id: string;
  title: string;
  framework: string | null;
  totalMinutes: number | null;
  version: number | null;
  status: string;
  createdAt: string;
  shareLink: { token: string; status: string; expiresAt: string } | null;
};

const cards = [
  { label: "采集", desc: "添加碎片素材", icon: "📥", href: (id: string) => `/collections/${id}/capture`, color: "border-gray-200 hover:border-blue-300" },
  { label: "整理", desc: "AI 生成培训内容", icon: "🧠", href: (id: string) => `/collections/${id}/structure`, color: "border-gray-200 hover:border-purple-300" },
  { label: "发布", desc: "管理分享链接和预览", icon: "📤", href: (id: string) => `/collections/${id}/publish`, color: "border-gray-200 hover:border-green-300" }
];

export default function CollectionDashboard() {
  const { id } = useParams<{ id: string }>();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [areaName, setAreaName] = useState("");
  const [fragmentCount, setFragmentCount] = useState(0);
  const [pages, setPages] = useState<TrainingPageItem[]>([]);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([
      fetch("/api/collections?userId=demo-user"),
      fetch("/api/areas?userId=demo-user")
    ]).then(async ([collectionRes, areaRes]) => {
      const collectionData = await collectionRes.json();
      const areaData = await areaRes.json();
      const nextCollection = (collectionData.collections as Collection[]).find((item) => item.id === id);
      setCollection(nextCollection ?? null);
      if (nextCollection?.areaId) {
        const area = (areaData.areas as { id: string; name: string }[]).find((a) => a.id === nextCollection.areaId);
        setAreaName(area?.name ?? "");
      }
    });

    fetch(`/api/knowledge-items?userId=demo-user&collectionId=${encodeURIComponent(id)}&limit=200`)
      .then((r) => r.json())
      .then((data) => setFragmentCount(
        (data.knowledgeItems ?? []).filter((i: { status: string }) => i.status !== "archived").length
      ));

    fetch("/api/training-pages?userId=demo-user&limit=50")
      .then((r) => r.json())
      .then((data) => setPages((data.trainingPages ?? []) as TrainingPageItem[]));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // 同步侧边栏选中
  useEffect(() => {
    if (collection) localStorage.setItem("knowledgecast_collection_id", collection.id);
  }, [collection]);

  async function copyLink(token: string) {
    await navigator.clipboard.writeText(`${window.location.origin}/share/${token}?preview=1`);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  }

  if (!collection) {
    return <main className="px-8 py-8"><p className="text-sm text-gray-400">加载中...</p></main>;
  }

  return (
    <main className="px-8 py-8">
      <div className="mb-8">
        {areaName && <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{areaName}</p>}
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">{collection.name}</h1>
        {collection.topic && <p className="mt-1 text-sm text-gray-500">{collection.topic}</p>}
        <div className="mt-3 flex gap-4 text-sm text-gray-500">
          <span>素材 {fragmentCount}</span>
          <span>培训页 {pages.length}</span>
        </div>
      </div>

      {/* 三卡片入口 */}
      <div className="grid gap-4 sm:grid-cols-3 mb-10">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href(id)}
            className={`rounded-xl border bg-white p-5 transition ${c.color} group`}
          >
            <div className="text-2xl mb-2">{c.icon}</div>
            <div className="text-sm font-semibold text-gray-900">{c.label}</div>
            <div className="text-xs text-gray-400 mt-0.5">{c.desc}</div>
          </Link>
        ))}
      </div>

      {/* 最近培训页 */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">最近培训页</h2>
          <Link href={`/collections/${id}/settings`} className="text-xs text-gray-400 hover:text-gray-600">⚙ 工作集设置</Link>
        </div>
        {pages.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center">
            <p className="text-sm text-gray-500">还没有培训页</p>
            <p className="mt-1 text-xs text-gray-400 mb-4">点击「整理」选择素材和框架，让 AI 生成第一份培训内容</p>
            <Link href={`/collections/${id}/structure`} className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700">去整理</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {pages.map((tp) => (
              <div key={tp.id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">{tp.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {tp.framework ?? "无框架"} · {tp.totalMinutes ?? "?"} 分钟 · V{tp.version ?? 1} · {new Date(tp.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {tp.shareLink && (
                    <button onClick={() => copyLink(tp.shareLink!.token)}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
                      {copiedToken === tp.shareLink.token ? "已复制 ✓" : "复制链接"}
                    </button>
                  )}
                  <a href={`/share/${tp.shareLink?.token ?? tp.id}?preview=1`} target="_blank" rel="noopener noreferrer"
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700">
                    预览
                  </a>
                  <Link href={`/collections/${id}/structure`}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50">
                    继续编辑
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
