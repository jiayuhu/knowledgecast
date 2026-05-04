"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { marked } from "marked";

marked.setOptions({ breaks: true, gfm: true });

const DANGEROUS_HREF = /(href|src)="(javascript|data):/gi;

function sanitizeHtml(html: string): string {
  return html.replace(DANGEROUS_HREF, '$1="#"');
}

function renderMarkdown(content: string): string {
  const escaped = content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return sanitizeHtml(marked.parse(escaped) as string);
}

type Fragment = {
  id: string;
  sourceType: string;
  title: string | null;
  content: string;
  originalUrl: string | null;
  status: string;
  createdAt: string;
};

type Props = {
  userId: string;
  workspaceId: string;
};

export function FragmentList({ userId, workspaceId }: Props) {
  const [fragments, setFragments] = useState<Fragment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editField, setEditField] = useState<"title" | "content" | null>(null);
  const [editValue, setEditValue] = useState("");
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  const loadFragments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/knowledge-items?userId=${encodeURIComponent(userId)}&workspaceId=${encodeURIComponent(workspaceId)}&limit=50`
      );
      if (!response.ok) throw new Error("加载失败");
      const data = await response.json();
      setFragments(data.knowledgeItems ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [userId, workspaceId]);

  useEffect(() => { loadFragments(); }, [loadFragments]);

  useEffect(() => {
    if (editingId && editField === "title") editInputRef.current?.focus();
    if (editingId && editField === "content") editTextareaRef.current?.focus();
  }, [editingId, editField]);

  function startEdit(f: Fragment, field: "title" | "content") {
    setEditingId(f.id);
    setEditField(field);
    setEditValue(field === "title" ? (f.title ?? "") : f.content);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditField(null);
    setEditValue("");
  }

  async function saveEdit(f: Fragment) {
    if (!editField || editValue === (editField === "title" ? (f.title ?? "") : f.content)) {
      cancelEdit();
      return;
    }
    const body: Record<string, unknown> = { userId };
    if (editField === "title") body.title = editValue.trim() || null;
    else body.content = editValue.trim();

    const res = await fetch(`/api/knowledge-items/${f.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      setActionError("保存失败，请重试");
      cancelEdit();
      return;
    }
    setFragments((prev) =>
      prev.map((item) => {
        if (item.id !== f.id) return item;
        if (editField === "title") return { ...item, title: editValue.trim() || null };
        return { ...item, content: editValue.trim() };
      })
    );
    cancelEdit();
  }

  if (loading) {
    return <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-400">加载中...</div>;
  }

  if (error) {
    return (
      <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <button onClick={loadFragments} className="mt-2 text-xs text-red-500 hover:text-red-700 underline">点击重试</button>
      </div>
    );
  }

  if (fragments.length === 0) {
    return (
      <div className="mt-8 rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
        <div className="text-3xl mb-3">📝</div>
        <p className="text-sm text-gray-500">还没有素材</p>
        <p className="mt-1 text-xs text-gray-400">在上方输入框粘贴文字、链接或 Markdown，Ctrl+Enter 快速提交</p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">素材库 ({fragments.length})</h2>
        {actionError && (
          <button
            onClick={() => setActionError("")}
            className="ml-auto text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded"
          >
            {actionError}
          </button>
        )}
        <button onClick={loadFragments} className="text-xs font-medium text-gray-500 hover:text-gray-700">刷新</button>
      </div>
      <div className="space-y-2">
        {fragments.map((f) => {
          const isEditingContent = editingId === f.id && editField === "content";
          return (
            <div key={f.id} className="group rounded-lg border border-gray-200 bg-white p-4 transition hover:border-gray-300">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* 标题 */}
                  {editingId === f.id && editField === "title" ? (
                    <input
                      ref={editInputRef}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveEdit(f); if (e.key === "Escape") cancelEdit(); }}
                      onBlur={() => saveEdit(f)}
                      className="w-full rounded border border-blue-300 bg-white px-2 py-1 text-sm font-medium text-gray-900 outline-none focus:ring-1 focus:ring-blue-200"
                    />
                  ) : (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startEdit(f, "title")}
                        className="text-left text-sm font-medium text-gray-900 hover:text-blue-600 cursor-text"
                        title="点击编辑标题"
                      >
                        {f.title ?? "未命名素材"}
                      </button>
                      <button
                        onClick={async () => {
                          if (generatingId) return;
                          setGeneratingId(f.id);
                          try {
                            const res = await fetch("/api/knowledge-items/generate-title", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ content: f.content })
                            });
                            if (res.ok) {
                              const data = await res.json();
                              await fetch(`/api/knowledge-items/${f.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ userId, title: data.title })
                              });
                              setFragments((prev) =>
                                prev.map((item) => item.id === f.id ? { ...item, title: data.title } : item)
                              );
                            }
                          } catch { /* ignore */ }
                          setGeneratingId(null);
                        }}
                        disabled={generatingId === f.id}
                        className={`hidden group-hover:inline-flex shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium transition ${generatingId === f.id ? "text-gray-300 cursor-not-allowed" : "text-blue-500 hover:bg-blue-50"}`}
                        title="AI 生成标题"
                      >
                        {generatingId === f.id ? "..." : "AI"}
                      </button>
                    </div>
                  )}

                  {/* 正文 */}
                  {isEditingContent ? (
                    <div className="mt-1">
                      <textarea
                        ref={editTextareaRef}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Escape") cancelEdit(); }}
                        onBlur={() => saveEdit(f)}
                        rows={6}
                        className="w-full rounded border border-blue-300 bg-white px-2 py-1 text-xs text-gray-700 font-mono outline-none focus:ring-1 focus:ring-blue-200 resize-none"
                      />
                      <div className="flex items-center gap-2 mt-1.5">
                        <button onClick={() => saveEdit(f)} className="text-xs text-blue-500 hover:text-blue-700">保存</button>
                        <button onClick={cancelEdit} className="text-xs text-gray-400 hover:text-gray-600">取消</button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1">
                      <div
                        className="text-xs text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-3 max-h-80 overflow-y-auto
                          [&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-3 [&_h1]:mb-1
                          [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-2 [&_h2]:mb-1
                          [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1
                          [&_p]:my-1
                          [&_ul]:my-1 [&_ul]:pl-4 [&_ul]:list-disc
                          [&_ol]:my-1 [&_ol]:pl-4 [&_ol]:list-decimal
                          [&_li]:my-0.5
                          [&_a]:text-blue-500 [&_a]:underline
                          [&_blockquote]:border-l-2 [&_blockquote]:border-gray-300 [&_blockquote]:pl-3 [&_blockquote]:text-gray-500 [&_blockquote]:my-1
                          [&_pre]:bg-gray-100 [&_pre]:rounded [&_pre]:p-2 [&_pre]:text-[11px] [&_pre]:overflow-x-auto [&_pre]:my-1
                          [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:rounded [&_code]:text-[11px]
                          [&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-2
                          [&_table]:w-full [&_table]:text-[11px]
                          [&_th]:border [&_th]:border-gray-300 [&_th]:px-2 [&_th]:py-1 [&_th]:bg-gray-100
                          [&_td]:border [&_td]:border-gray-300 [&_td]:px-2 [&_td]:py-1"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(f.content) }}
                      />
                      <button
                        onClick={() => startEdit(f, "content")}
                        className="hidden group-hover:inline-block mt-1.5 text-xs text-gray-400 hover:text-blue-500"
                      >
                        编辑源码
                      </button>
                    </div>
                  )}

                  {/* 原始链接 */}
                  {f.sourceType === "url" && f.originalUrl && (
                    <a
                      href={f.originalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500 transition-colors w-fit"
                      title={f.originalUrl}
                    >
                      <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      <span className="truncate max-w-[280px]">{f.originalUrl}</span>
                    </a>
                  )}
                </div>

                {/* 右侧操作 */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={async () => {
                      const res = await fetch(`/api/knowledge-items/${f.id}`, {
                        method: "DELETE",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ userId })
                      });
                      if (!res.ok) {
                        setActionError("删除失败，请重试");
                        return;
                      }
                      setFragments((prev) => prev.filter((item) => item.id !== f.id));
                    }}
                    className="hidden group-hover:block rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    title="删除"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                  <span className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-500">{f.sourceType}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
