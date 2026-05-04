"use client";

import { useState } from "react";

type Props = {
  userId: string;
  workspaceId: string;
  onDone: () => void;
};

function detectSourceType(content: string): "text" | "url" | "markdown" {
  const trimmed = content.trim();
  if (/^https?:\/\/\S+/.test(trimmed)) return "url";
  if (/^#{1,6}\s|^\*{1,2}\S|^- |^>\s|```/.test(trimmed)) return "markdown";
  return "text";
}

function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s)>"']+/g);
  if (!matches) return [];
  return [...new Set(matches)];
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname + u.pathname.slice(0, 30) + (u.pathname.length > 30 ? "..." : "");
  } catch {
    return url.slice(0, 50);
  }
}

async function createUrlItem(
  userId: string,
  workspaceId: string,
  url: string
): Promise<{ id: string; title: string | null }> {
  const res = await fetch("/api/knowledge-items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      workspaceId,
      sourceType: "url",
      title: null,
      content: url,
      enrich: true  // 提取 URL：获取正文 + 图片
    })
  });
  if (!res.ok) throw new Error("创建失败");
  const data = await res.json();
  return { id: data.item.id, title: data.item.title ?? null };
}

async function generateTitle(content: string): Promise<string> {
  const res = await fetch("/api/knowledge-items/generate-title", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content })
  });
  if (!res.ok) throw new Error("标题生成失败");
  const data = await res.json();
  return data.title;
}

async function patchTitle(userId: string, itemId: string, title: string) {
  await fetch(`/api/knowledge-items/${itemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, title })
  });
}

export function CaptureInput({ userId, workspaceId, onDone }: Props) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"info" | "success" | "error">("info");

  function show(msg: string, type: "info" | "success" | "error" = "info") {
    setMessage(msg);
    setMessageType(type);
  }

  async function handleSubmit() {
    if (!content.trim()) return;
    const input = content.trim();
    const sourceType = detectSourceType(input);
    setLoading(true);
    show("");

    try {
      if (sourceType === "url") {
        show(`正在获取页面正文…`);
      }

      const response = await fetch("/api/knowledge-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          workspaceId,
          sourceType,
          title: null,
          content: input,
          enrich: false  // 捕获素材：原样保存，不穿透 URL
        })
      });

      if (!response.ok) throw new Error("捕获失败");

      const data = await response.json();
      const itemId = data.item?.id as string;
      setContent("");

      if (sourceType === "url" && data.item?.title) {
        show("素材已捕获", "success");
      } else if (sourceType === "url") {
        show("正文已获取，正在生成标题…");
        if (itemId) {
          try {
            const title = await generateTitle(input);
            await patchTitle(userId, itemId, title);
          } catch { /* ignore */ }
        }
        show("素材已捕获", "success");
      } else {
        show("素材已捕获，正在生成标题…");
        if (itemId) {
          try {
            const title = await generateTitle(input);
            await patchTitle(userId, itemId, title);
          } catch { /* ignore */ }
        }
        show("素材已捕获", "success");
      }

      onDone();
    } catch (e) {
      show(e instanceof Error ? e.message : "捕获失败", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleExtractUrls() {
    if (!content.trim()) return;
    const urls = extractUrls(content.trim());
    if (urls.length === 0) {
      show("未检测到 URL 链接", "error");
      return;
    }

    setLoading(true);

    let success = 0;
    let fail = 0;

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      show(`正在获取 (${i + 1}/${urls.length}): ${shortUrl(url)}…`);

      try {
        const item = await createUrlItem(userId, workspaceId, url);
        if (!item.title) {
          try {
            const title = await generateTitle(url);
            await patchTitle(userId, item.id, title);
          } catch { /* ignore */ }
        }
        success++;
      } catch {
        fail++;
      }
    }

    setContent("");
    const parts: string[] = [];
    if (success > 0) parts.push(`${success} 个素材已捕获`);
    if (fail > 0) parts.push(`${fail} 个失败`);
    show(parts.join("，"), fail === 0 ? "success" : "error");

    if (success > 0) onDone();
    setLoading(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }

  const msgColors = {
    info: "bg-blue-50 text-blue-700",
    success: "bg-green-50 text-green-700",
    error: "bg-red-50 text-red-700"
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
        快速捕获
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={6}
        className="mt-3 w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
        placeholder="直接粘贴一段文字、链接、或 Markdown 内容..."
        disabled={loading}
      />
      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-gray-400">Ctrl + Enter 快速提交</p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExtractUrls}
            disabled={loading || !content.trim()}
            className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
          >
            {loading ? "捕获中…" : "提取 URL 素材"}
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !content.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "捕获中…" : "捕获素材"}
          </button>
        </div>
      </div>
      {message && (
        <p className={`mt-3 rounded-lg px-3 py-2 text-xs font-medium ${msgColors[messageType]}`}>
          {message}
        </p>
      )}
    </div>
  );
}
