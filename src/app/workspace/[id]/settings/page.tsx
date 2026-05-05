"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Area = { id: string; name: string; userId: string };
type Workspace = { id: string; name: string; topic: string | null; areaId: string | null; userId: string };
type TrainingPageItem = { id: string; title: string; framework: string | null; totalMinutes: number | null; version: number | null; status: string; createdAt: string };

export default function SettingsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [areaName, setAreaName] = useState("");
  const [areas, setAreas] = useState<Area[]>([]);
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [areaId, setAreaId] = useState("");
  const [saving, setSaving] = useState(false);
  const [fragmentCount, setFragmentCount] = useState(0);
  const [trainingPages, setTrainingPages] = useState<TrainingPageItem[]>([]);
  const [message, setMessage] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch("/api/workspaces?userId=demo-user")
      .then((r) => r.json())
      .then((data) => {
        const ws = (data.workspaces as Workspace[]).find((w) => w.id === id) ?? null;
        setWorkspace(ws);
        if (ws) { setName(ws.name); setTopic(ws.topic ?? ""); setAreaId(ws.areaId ?? ""); }
      });

    fetch("/api/areas?userId=demo-user")
      .then((r) => r.json())
      .then((d) => setAreas((d.areas ?? []) as Area[]));
  }, [id]);

  useEffect(() => {
    if (workspace?.areaId && areas.length > 0) {
      const area = areas.find((a) => a.id === workspace.areaId);
      setAreaName(area?.name ?? "");
    }
  }, [workspace, areas]);

  useEffect(() => {
    if (!workspace) return;
    fetch(`/api/knowledge-items?userId=demo-user&workspaceId=${encodeURIComponent(workspace.id)}&limit=100`)
      .then((r) => r.json())
      .then((data) => setFragmentCount((data.knowledgeItems ?? []).filter((i: { status: string }) => i.status !== "archived").length));
    fetch("/api/training-pages?userId=demo-user&limit=20")
      .then((r) => r.json())
      .then((data) => setTrainingPages(data.trainingPages ?? []));
  }, [workspace]);

  async function handleSave() {
    if (!workspace || !name.trim()) return;
    setSaving(true);
    await fetch(`/api/workspaces/${workspace.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), topic: topic.trim() || null, areaId: areaId || null })
    });
    setWorkspace({ ...workspace, name: name.trim(), topic: topic.trim() || null });
    window.dispatchEvent(new CustomEvent("workspace-changed", { detail: { ...workspace, name: name.trim(), topic: topic.trim() || null } }));
    window.dispatchEvent(new CustomEvent("sidebar-refresh"));
    setSaving(false);
    setMessage("已保存");
    setTimeout(() => setMessage(""), 2000);
  }

  async function handleDelete() {
    if (!workspace) return;
    setDeleting(true);
    await fetch(`/api/workspaces/${workspace.id}`, { method: "DELETE" });
    window.dispatchEvent(new CustomEvent("sidebar-refresh"));
    router.push("/workspace/capture");
  }

  if (!workspace) return <main className="mx-auto max-w-2xl px-8 py-8"><p className="text-sm text-gray-400">加载中...</p></main>;

  return (
    <main className="px-8 py-8">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-2">工作集设置</h1>
      <p className="text-sm text-gray-500 mb-6">编辑工作集信息，管理关联的培训内容</p>

      <section className="rounded-xl border border-gray-200 bg-white p-6 mb-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500 mb-4">基本信息</h2>
        <label className="block text-sm font-medium text-gray-700 mb-1">工作集名称
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100" />
        </label>
        <label className="block text-sm font-medium text-gray-700 mb-1 mt-4">所属工作区
          <select value={areaId} onChange={(e) => setAreaId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100">
            {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium text-gray-700 mb-1 mt-4">培训主题
          <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={3}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 resize-none"
            placeholder="描述这场培训的目的和受众，帮助 AI 生成更精准的内容" />
        </label>
        {message && <p className="mt-3 text-xs text-green-600">{message}</p>}
        <button onClick={handleSave} disabled={saving || !name.trim()}
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50">
          {saving ? "保存中..." : "保存"}
        </button>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 mb-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500 mb-4">统计</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-gray-50 p-3 text-center"><div className="text-2xl font-bold text-gray-900">{fragmentCount}</div><div className="text-xs text-gray-500 mt-1">素材</div></div>
          <div className="rounded-lg bg-gray-50 p-3 text-center"><div className="text-2xl font-bold text-gray-900">{trainingPages.length}</div><div className="text-xs text-gray-500 mt-1">培训页</div></div>
        </div>
      </section>

      {/* 危险区域 */}
      <section className="rounded-xl border border-red-200 bg-red-50/30 p-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-red-600 mb-2">危险区域</h2>
        <p className="text-sm text-gray-600 mb-1">删除此工作集后：</p>
        <ul className="text-sm text-gray-500 list-disc list-inside mb-4 space-y-0.5">
          <li>工作集下的 {fragmentCount} 个素材<b>不会被删除</b>，会脱离工作集保留在系统中</li>
          <li>关联的培训页也将脱离工作集</li>
          <li>此操作<b>不可撤销</b></li>
        </ul>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition"
          >
            删除此工作集
          </button>
        ) : (
          <div className="rounded-lg border border-red-300 bg-white p-4">
            <p className="text-sm font-medium text-gray-900 mb-3">
              请输入工作集名称 <span className="text-red-600 font-bold">{workspace.name}</span> 以确认删除：
            </p>
            <div className="flex gap-2">
              <input
                autoFocus
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") { setShowDeleteConfirm(false); setDeleteConfirmName(""); } }}
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-100"
              />
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmName(""); }}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteConfirmName !== workspace.name || deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition disabled:opacity-50"
              >
                {deleting ? "删除中..." : "确认删除"}
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
