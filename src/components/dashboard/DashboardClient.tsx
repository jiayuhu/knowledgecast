"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";

type KnowledgeItem = {
  id: string;
  userId: string;
  sourceType: string;
  title: string | null;
  content: string;
  status: string;
};

type TrainingPageResult = {
  trainingPage: {
    id: string;
    title: string;
    status: string;
    outline: string[];
    content: string[];
  };
  shareLink: {
    token: string;
    status: string;
    expiresAt: string;
  };
};

type RecentTrainingPage = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  shareLink: {
    token: string;
    status: string;
    expiresAt: string;
  } | null;
};

type RecentKnowledgeItem = {
  id: string;
  sourceType: string;
  title: string | null;
  content: string;
  status: string;
  createdAt: string;
};

const sourceTypeOptions = [
  { value: "text", label: "Text" },
  { value: "markdown", label: "Markdown" },
  { value: "url", label: "Link" },
  { value: "voice", label: "Voice" }
] as const;

export function DashboardClient() {
  const [userId, setUserId] = useState("demo-user");
  const [sourceType, setSourceType] = useState<KnowledgeItem["sourceType"]>("text");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [captureState, setCaptureState] = useState<{
    loading: boolean;
    message: string;
  }>({
    loading: false,
    message: ""
  });
  const [generationState, setGenerationState] = useState<{
    loading: boolean;
    message: string;
  }>({
    loading: false,
    message: ""
  });
  const [historyState, setHistoryState] = useState<{
    loading: boolean;
    message: string;
  }>({
    loading: false,
    message: ""
  });
  const [recentKnowledgeItems, setRecentKnowledgeItems] = useState<RecentKnowledgeItem[]>([]);
  const [recentTrainingPages, setRecentTrainingPages] = useState<RecentTrainingPage[]>([]);
  const [latestResult, setLatestResult] = useState<TrainingPageResult | null>(null);

  const selectedCount = selectedItemIds.length;
  const generatedShareUrl = latestResult
    ? `/share/${latestResult.shareLink.token}`
    : "";

  useEffect(() => {
    void loadRecentTrainingPages();
    // The current userId is loaded from the UI; auto-refresh once on mount.
  }, []);

  async function loadRecentTrainingPages() {
    setHistoryState({ loading: true, message: "" });

    try {
      const [knowledgeResponse, trainingResponse] = await Promise.all([
        fetch(`/api/knowledge-items?userId=${encodeURIComponent(userId)}&limit=5`),
        fetch(`/api/training-pages?userId=${encodeURIComponent(userId)}&limit=5`)
      ]);

      if (!knowledgeResponse.ok || !trainingResponse.ok) {
        throw new Error("Failed to load recent history.");
      }

      const knowledgePayload = (await knowledgeResponse.json()) as {
        knowledgeItems: RecentKnowledgeItem[];
      };
      const trainingPayload = (await trainingResponse.json()) as {
        trainingPages: RecentTrainingPage[];
      };

      setRecentKnowledgeItems(knowledgePayload.knowledgeItems);
      setRecentTrainingPages(trainingPayload.trainingPages);
      setHistoryState({
        loading: false,
        message:
          trainingPayload.trainingPages.length > 0 || knowledgePayload.knowledgeItems.length > 0
            ? "History refreshed."
            : "No history yet."
      });
    } catch (error) {
      setHistoryState({
        loading: false,
        message: error instanceof Error ? error.message : "Failed to load recent history."
      });
    }
  }

  async function handleCaptureSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCaptureState({ loading: true, message: "" });

    try {
      const response = await fetch("/api/knowledge-items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId,
          sourceType,
          title: title.trim() || null,
          content
        })
      });

      if (!response.ok) {
        throw new Error("Failed to capture knowledge item.");
      }

      const payload = (await response.json()) as { item: KnowledgeItem };
      setKnowledgeItems((current) => [payload.item, ...current]);
      setSelectedItemIds((current) => [payload.item.id, ...current]);
      setContent("");
      setTitle("");
      setCaptureState({
        loading: false,
        message: `Captured item ${payload.item.id.slice(0, 8)}.`
      });
    } catch (error) {
      setCaptureState({
        loading: false,
        message:
          error instanceof Error ? error.message : "Failed to capture knowledge item."
      });
    }
  }

  async function handleGenerateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGenerationState({ loading: true, message: "" });

    try {
      const response = await fetch("/api/training-pages/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId,
          knowledgeItemIds: selectedItemIds
        })
      });

      if (!response.ok) {
        throw new Error("Failed to generate training page.");
      }

      const payload = (await response.json()) as TrainingPageResult;
      setLatestResult(payload);
      setGenerationState({
        loading: false,
        message: "Training page generated."
      });
      await loadRecentTrainingPages();
    } catch (error) {
      setGenerationState({
        loading: false,
        message:
          error instanceof Error ? error.message : "Failed to generate training page."
      });
    }
  }

  function toggleSelectedItem(id: string) {
    setSelectedItemIds((current) =>
      current.includes(id)
        ? current.filter((itemId) => itemId !== id)
        : [id, ...current]
    );
  }

  return (
    <main className="min-h-screen bg-[#f8f7f3] px-6 py-10 text-black">
      <div className="mx-auto max-w-6xl">
        <section className="rounded-[2rem] border border-black/10 bg-white px-6 py-8 shadow-[0_30px_120px_-80px_rgba(0,0,0,0.35)] sm:px-8">
          <p className="text-sm font-medium uppercase tracking-[0.28em] text-black/40">
            KnowledgeCast Dashboard
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                Capture, organize, and generate training pages.
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-black/65">
                Add fragmented notes, choose what to include, and generate a private
                internal page with one click.
              </p>
            </div>
          </div>
        </section>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[2rem] border border-black/10 bg-white px-6 py-6 shadow-[0_24px_90px_-75px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">
                  Capture knowledge
                </h2>
                <p className="mt-1 text-sm text-black/55">
                  Save text, links, markdown, or voice notes into the working set.
                </p>
              </div>
              <div className="rounded-full bg-black/5 px-4 py-2 text-sm text-black/55">
                {knowledgeItems.length} items
              </div>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleCaptureSubmit}>
              <label className="block text-sm font-medium text-black/70">
                User ID
                <input
                  value={userId}
                  onChange={(event) => setUserId(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-black/40"
                  placeholder="demo-user"
                />
              </label>

              <label className="block text-sm font-medium text-black/70">
                Source type
                <select
                  value={sourceType}
                  onChange={(event) =>
                    setSourceType(event.target.value as KnowledgeItem["sourceType"])
                  }
                  className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-black/40"
                >
                  {sourceTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium text-black/70">
                Title
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-black/40"
                  placeholder="Optional title"
                />
              </label>

              <label className="block text-sm font-medium text-black/70">
                Content
                <textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  rows={8}
                  required
                  className="mt-2 w-full rounded-3xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-black/40"
                  placeholder="Paste a note, link, or markdown content here"
                />
              </label>

              <button
                type="submit"
                className="w-full rounded-2xl bg-black px-4 py-3 text-sm font-medium text-white transition hover:bg-black/85 disabled:opacity-60"
                disabled={captureState.loading}
              >
                {captureState.loading ? "Capturing..." : "Capture knowledge"}
              </button>
            </form>

            {captureState.message ? (
              <p className="mt-4 rounded-2xl bg-black/5 px-4 py-3 text-sm text-black/70">
                {captureState.message}
              </p>
            ) : null}

            <div className="mt-8">
              <h3 className="text-sm font-medium uppercase tracking-[0.22em] text-black/40">
                Working set
              </h3>
              <div className="mt-4 space-y-3">
                {knowledgeItems.length > 0 ? (
                  knowledgeItems.map((item) => {
                    const active = selectedItemIds.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleSelectedItem(item.id)}
                        className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                          active
                            ? "border-black bg-black text-white"
                            : "border-black/10 bg-black/5 hover:border-black/20"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium">
                              {item.title ?? item.sourceType}
                            </div>
                            <div
                              className={`mt-1 text-sm ${
                                active ? "text-white/70" : "text-black/55"
                              }`}
                            >
                              {item.content.slice(0, 120)}
                            </div>
                          </div>
                          <span
                            className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em] ${
                              active
                                ? "bg-white/10 text-white"
                                : "bg-black/5 text-black/45"
                            }`}
                          >
                            {item.sourceType}
                          </span>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-black/10 px-4 py-6 text-sm text-black/50">
                    No captured items yet. Add one above to start a working set.
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-[2rem] border border-black/10 bg-white px-6 py-6 shadow-[0_24px_90px_-75px_rgba(0,0,0,0.35)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">
                    Generate training page
                  </h2>
                  <p className="mt-1 text-sm text-black/55">
                    Use the selected items to create a private training page and share link.
                  </p>
                </div>
                <div className="rounded-full bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
                  {selectedCount} selected
                </div>
              </div>

              <form className="mt-6 space-y-4" onSubmit={handleGenerateSubmit}>
                <label className="block text-sm font-medium text-black/70">
                  User ID
                  <input
                    value={userId}
                    onChange={(event) => setUserId(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-black/40"
                  />
                </label>

                <label className="block text-sm font-medium text-black/70">
                  Selected item IDs
                  <textarea
                    readOnly
                    value={selectedItemIds.join(", ")}
                    rows={4}
                    className="mt-2 w-full rounded-3xl border border-black/10 bg-black/5 px-4 py-3 font-mono text-sm outline-none"
                    placeholder="Select items from the left panel"
                  />
                </label>

                <button
                  type="submit"
                  className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
                  disabled={generationState.loading || selectedItemIds.length === 0}
                >
                  {generationState.loading ? "Generating..." : "Generate training page"}
                </button>
              </form>

              {generationState.message ? (
                <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  {generationState.message}
                </p>
              ) : null}
            </div>

            <div className="rounded-[2rem] border border-black/10 bg-white px-6 py-6 shadow-[0_24px_90px_-75px_rgba(0,0,0,0.35)]">
              <h3 className="text-sm font-medium uppercase tracking-[0.22em] text-black/40">
                Latest result
              </h3>

              {latestResult ? (
                <div className="mt-4 space-y-4">
                  <div>
                    <div className="text-3xl font-semibold tracking-tight">
                      {latestResult.trainingPage.title}
                    </div>
                    <div className="mt-1 text-sm text-black/55">
                      Training page {latestResult.trainingPage.status}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-black/10 bg-black/5 px-4 py-3 text-sm">
                    <div className="font-medium text-black/60">Share link</div>
                    <div className="mt-1 break-all font-mono text-black">
                      {generatedShareUrl}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium uppercase tracking-[0.22em] text-black/40">
                      Outline
                    </div>
                    <ul className="mt-3 space-y-2">
                      {latestResult.trainingPage.outline.map((item) => (
                        <li key={item} className="rounded-2xl bg-black/5 px-4 py-3">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <div className="text-sm font-medium uppercase tracking-[0.22em] text-black/40">
                      Content blocks
                    </div>
                    <div className="mt-3 space-y-3 text-sm leading-7 text-black/70">
                      {latestResult.trainingPage.content.map((block) => (
                        <p key={block} className="rounded-2xl bg-black/5 px-4 py-3">
                          {block}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-black/10 px-4 py-8 text-sm text-black/50">
                  Generate a training page to see the title, share link, outline, and content
                  blocks here.
                </div>
              )}
            </div>

            <div className="rounded-[2rem] border border-black/10 bg-white px-6 py-6 shadow-[0_24px_90px_-75px_rgba(0,0,0,0.35)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-medium uppercase tracking-[0.22em] text-black/40">
                    Recent knowledge
                  </h3>
                  <p className="mt-2 text-sm text-black/55">
                    Pull the latest captured notes for the current user.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadRecentTrainingPages()}
                  className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-black transition hover:border-black/20 hover:bg-black/3 disabled:opacity-60"
                  disabled={historyState.loading}
                >
                  {historyState.loading ? "Loading..." : "Refresh"}
                </button>
              </div>

              {historyState.message ? (
                <p className="mt-4 rounded-2xl bg-black/5 px-4 py-3 text-sm text-black/65">
                  {historyState.message}
                </p>
              ) : null}

              <div className="mt-4 space-y-3">
                {recentKnowledgeItems.length > 0 ? (
                  recentKnowledgeItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-black/10 bg-black/3 px-4 py-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-medium">{item.title}</div>
                          <div className="mt-1 text-sm text-black/55">
                            {item.sourceType} · {item.status} ·{" "}
                            {new Date(item.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <span className="rounded-full bg-black/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-black/45">
                          knowledge
                        </span>
                      </div>
                      <p className="mt-3 line-clamp-2 text-sm leading-6 text-black/65">
                        {item.content}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-black/10 px-4 py-8 text-sm text-black/50">
                    No recent knowledge items yet.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[2rem] border border-black/10 bg-white px-6 py-6 shadow-[0_24px_90px_-75px_rgba(0,0,0,0.35)]">
              <h3 className="text-sm font-medium uppercase tracking-[0.22em] text-black/40">
                Recent results
              </h3>

              <div className="mt-4 space-y-3">
                {recentTrainingPages.length > 0 ? (
                  recentTrainingPages.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-black/10 bg-black/3 px-4 py-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-medium">{item.title}</div>
                          <div className="mt-1 text-sm text-black/55">
                            {item.status} · {new Date(item.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <span className="rounded-full bg-black/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-black/45">
                          {item.shareLink ? item.shareLink.status : "no share"}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3 text-sm">
                        {item.shareLink ? (
                          <a
                            href={`/share/${item.shareLink.token}`}
                            className="rounded-full bg-black px-4 py-2 font-medium text-white transition hover:bg-black/85"
                          >
                            Open share
                          </a>
                        ) : null}
                        <span className="rounded-full bg-black/5 px-4 py-2 font-mono text-black/70">
                          {item.id.slice(0, 8)}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-black/10 px-4 py-8 text-sm text-black/50">
                    No recent training pages yet.
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
