"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Fragment = {
  id: string;
  sourceType: string;
  title: string | null;
  content: string;
  status: string;
  createdAt: string;
};

type Collection = { id: string; name: string; areaId: string | null; userId: string };

export default function OrphanedPage() {
  const router = useRouter();
  const [fragments, setFragments] = useState<Fragment[]>([]);
  const [workspaces, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [reassigning, setReassigning] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(() => {
    fetch("/api/knowledge-items?userId=demo-user&orphaned=true&limit=200")
      .then((r) => r.json())
      .then((data) => setFragments((data.knowledgeItems ?? []) as Fragment[]))
      .finally(() => setLoading(false));

    fetch("/api/collections?userId=demo-user")
      .then((r) => r.json())
      .then((data) => setCollections((data.collections ?? []) as Collection[]));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleReassign(fragmentId: string, collectionId: string) {
    setReassigning(fragmentId);
    setMessage("");
    try {
      const res = await fetch(`/api/knowledge-items/${fragmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "demo-user", collectionId }),
      });
      if (!res.ok) throw new Error("转移失败");
      setFragments((prev) => prev.filter((f) => f.id !== fragmentId));
      setMessage("已转移");
      setTimeout(() => setMessage(""), 2000);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "转移失败");
    } finally {
      setReassigning(null);
    }
  }

  if (loading) {
    return <main className="px-8 py-8"><p className="text-sm text-gray-400">加载中...</p></main>;
  }

  return (
    <main className="px-8 py-8">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-2">未归类素材</h1>
      <p className="text-sm text-gray-500 mb-6">
        这些素材已脱离工作集（通常来自删除工作集操作），可重新分配到任意工作集。
      </p>

      {message && (
        <p className={`rounded-lg px-3 py-2 text-xs font-medium mb-4 ${
          message === "已转移" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
        }`}>{message}</p>
      )}

      {fragments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-sm text-gray-500">没有未归类的素材</p>
          <p className="text-xs text-gray-400 mt-1">删除工作集时，素材会被保留并出现在这里</p>
        </div>
      ) : (
        <div className="space-y-2">
          {fragments.map((f) => (
            <div key={f.id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex-1 min-w-0 mr-4">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {f.title ?? f.content.slice(0, 60)}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {f.sourceType} · {new Date(f.createdAt).toLocaleDateString()}
                </p>
              </div>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) handleReassign(f.id, e.target.value);
                }}
                disabled={reassigning === f.id}
                className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 outline-none focus:border-blue-400"
              >
                <option value="">转移到…</option>
                {workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>{ws.name}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
