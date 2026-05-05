"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { FrameworkPicker } from "@/components/workspace/FrameworkPicker";
import { SlidePreview } from "@/components/workspace/SlidePreview";
import { IterationPanel } from "@/components/workspace/IterationPanel";
import { VersionBar } from "@/components/workspace/VersionBar";

type Workspace = { id: string; name: string; areaId: string | null; userId: string; topic?: string | null };
type Fragment = { id: string; sourceType: string; title: string | null; content: string; status: string };
type Slide = { title: string; bullets: string[]; speakerNotes: string; estimatedMinutes: number };
type TrainingResult = {
  trainingPage: { id: string; title: string; framework: string | null; slidesJson: string | null; totalMinutes: number | null; version: number | null; status: string };
  shareLink: { token: string; status: string; expiresAt: string } | null;
};

function ShareLinkCard({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const shareUrl = `${window.location.origin}/share/${token}?preview=1`;
  return (
    <div className="rounded-xl border border-dashed border-green-200 bg-green-50 p-4">
      <p className="text-xs font-medium text-green-800 mb-2">分享链接已生成</p>
      <div className="flex items-center gap-1">
        <input readOnly value={shareUrl} className="flex-1 rounded-lg border border-green-200 bg-white px-2 py-1.5 text-xs text-gray-700 outline-none font-mono" />
        <button onClick={async () => { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="shrink-0 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700">{copied ? "已复制 ✓" : "复制"}</button>
      </div>
    </div>
  );
}

export default function StructurePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [userId] = useState("demo-user");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [areaName, setAreaName] = useState("");
  const [workspaceTopic, setWorkspaceTopic] = useState("");
  const [fragments, setFragments] = useState<Fragment[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [frameworkId, setFrameworkId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [iterating, setIterating] = useState(false);
  const [result, setResult] = useState<TrainingResult | null>(null);
  const [message, setMessage] = useState("");
  const [previewSlidesJson, setPreviewSlidesJson] = useState<string | null>(null);
  const [hasManualEdits, setHasManualEdits] = useState(false);

  const loadWorkspace = useCallback(() => {
    Promise.all([
      fetch("/api/workspaces?userId=demo-user"),
      fetch("/api/areas?userId=demo-user")
    ]).then(async ([wsRes, areaRes]) => {
      const wsData = await wsRes.json();
      const areaData = await areaRes.json();
      const ws = (wsData.workspaces as Workspace[]).find((w) => w.id === id) ?? null;
      setWorkspace(ws);
      if (ws) {
        setWorkspaceTopic(ws.topic ?? "");
        localStorage.setItem("knowledgecast_workspace_id", ws.id);
        if (ws.areaId) {
          const area = (areaData.areas as { id: string; name: string }[]).find((a) => a.id === ws.areaId);
          setAreaName(area?.name ?? "");
        }
      }
    });
  }, [id]);

  useEffect(() => { loadWorkspace(); }, [loadWorkspace]);

  useEffect(() => {
    if (!workspace) return;
    const cached = localStorage.getItem(`kc_result_${workspace.id}`);
    if (cached) { try { setResult(JSON.parse(cached)); } catch { setResult(null); } }
  }, [workspace]);

  useEffect(() => {
    if (result && workspace) localStorage.setItem(`kc_result_${workspace.id}`, JSON.stringify(result));
  }, [result, workspace]);

  useEffect(() => {
    if (!workspace) return;
    fetch(`/api/knowledge-items?userId=demo-user&workspaceId=${encodeURIComponent(workspace.id)}&limit=50`)
      .then((r) => r.json())
      .then((data) => {
        const items = (data.knowledgeItems ?? [] as Fragment[]).filter((f: Fragment) => f.status !== "archived");
        setFragments(items);
        if (items.length === 0) {
          setMessage("当前工作集还没有素材，请先采集素材");
          setTimeout(() => router.push(`/workspace/${id}/capture`), 1500);
        }
      })
      .catch(() => setMessage("加载素材失败"));
  }, [workspace]);

  function toggleFragment(fid: string) { setSelectedIds((prev) => prev.includes(fid) ? prev.filter((i) => i !== fid) : [...prev, fid]); }

  async function handleGenerate() {
    if (!frameworkId || !workspace) { setMessage("请先选择工作集和培训框架"); return; }
    setGenerating(true); setMessage("");
    try {
      const res = await fetch("/api/training-pages/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, knowledgeItemIds: selectedIds, frameworkId, topic: workspaceTopic || undefined })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "生成失败");
      }
      setResult(await res.json() as TrainingResult);
      setMessage("生成成功");
    } catch (e) { setMessage(e instanceof Error ? e.message : "生成失败"); }
    finally { setGenerating(false); }
  }

  async function handleIterate() {
    if (!instruction.trim() || !result || !frameworkId) return;
    setIterating(true); setMessage("");
    try {
      const res = await fetch(`/api/training-pages/${result.trainingPage.id}/iterate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, knowledgeItemIds: selectedIds, frameworkId, instruction: instruction.trim() })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "调整失败");
      }
      setResult(await res.json() as TrainingResult);
      setInstruction(""); setMessage("调整完成");
    } catch (e) { setMessage(e instanceof Error ? e.message : "调整失败"); }
    finally { setIterating(false); }
  }

  async function handleRestore(restoreSlidesJson: string, targetVersion: number) {
    if (!result) return;
    try {
      const parsed = JSON.parse(restoreSlidesJson);
      const res = await fetch(`/api/training-pages/${result.trainingPage.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          slidesJson: restoreSlidesJson,
          title: parsed.title,
          totalMinutes: parsed.totalMinutes,
          version: (result.trainingPage.version ?? 1) + 1,
          restoreInstruction: `恢复到 v${targetVersion}`,
          preRestoreVersion: result.trainingPage.version ?? 1,
          preRestoreSlidesJson: result.trainingPage.slidesJson
        })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "恢复失败");
      }
      const updated = await res.json() as TrainingResult;
      setResult(updated);
      setPreviewSlidesJson(null);
      setHasManualEdits(false);
      setMessage("已恢复");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "恢复失败");
    } finally {
    }
  }

  const slidesJson = previewSlidesJson ?? result?.trainingPage.slidesJson;
  const slides: Slide[] = slidesJson ? JSON.parse(slidesJson).slides : [];

  return (
    <main className="px-8 py-8">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-2">整理内容</h1>
      <p className="text-sm text-gray-500 mb-6">选择培训框架，选中素材，AI 将其组织成结构化幻灯片</p>
      {workspace ? (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-6">
            <FrameworkPicker userId={userId} selectedId={frameworkId} onSelect={setFrameworkId} />
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">选择素材</h2>
                <span className="text-xs text-gray-400">{selectedIds.length}/{fragments.length}</span>
              </div>
              <div className="mt-4 max-h-64 space-y-1 overflow-y-auto">
                {fragments.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-xs text-gray-400 mb-2">当前工作集还没有素材</p>
                    <Link href={`/workspace/${id}/capture`} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                      去采集页添加 →
                    </Link>
                  </div>
                ) : fragments.map((f) => (
                  <button key={f.id} onClick={() => toggleFragment(f.id)}
                    className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs transition ${selectedIds.includes(f.id) ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50"}`}>
                    <input type="checkbox" checked={selectedIds.includes(f.id)} onChange={() => {}} className="h-3.5 w-3.5 rounded border-gray-300" />
                    <span className="flex-1 truncate">{f.title ?? f.content.slice(0, 40)}</span>
                  </button>
                ))}
              </div>
            </div>
            <button onClick={handleGenerate} disabled={generating || !frameworkId} className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50">
              {generating ? "AI 生成中..." : "生成培训幻灯片"}
            </button>
            {message && (
              <p className={`rounded-lg px-3 py-2 text-xs font-medium ${
                message.includes("成功") || message.includes("完成")
                  ? "bg-green-50 text-green-700"
                  : message.includes("失败")
                    ? "bg-red-50 text-red-700"
                    : "bg-gray-100 text-gray-600"
              }`}>{message}</p>
            )}
            {result && (
              <VersionBar
                currentVersion={result.trainingPage.version ?? 1}
                trainingPageId={result.trainingPage.id}
                currentSlidesJson={result.trainingPage.slidesJson}
                onVersionSelect={(json, _version) => setPreviewSlidesJson(json)}
                onRestore={handleRestore}
                hasManualEdits={hasManualEdits}
              />
            )}
            {result?.shareLink && <ShareLinkCard token={result.shareLink.token} />}
            {result && <IterationPanel instruction={instruction} onInstructionChange={setInstruction} onSubmit={handleIterate} loading={iterating} />}
          </aside>
          <section>
            <SlidePreview slides={slides} title={result?.trainingPage.title ?? ""} totalMinutes={result?.trainingPage.totalMinutes ?? 0}
              shareUrl={result?.shareLink ? `/share/${result.shareLink.token}` : ""} />
          </section>
        </div>
      ) : <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center"><p className="text-sm text-gray-400">加载中...</p></div>}
    </main>
  );
}
