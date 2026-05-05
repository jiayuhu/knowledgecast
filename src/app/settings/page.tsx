"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type AISettingsStatus = {
  configured: boolean;
  provider: string;
  hasApiKey: boolean;
  model: string;
  message: string;
};

type Settings = {
  aiProvider: string;
  deepseekApiKey: string;
  deepseekModel: string;
  openaiApiKey: string;
  openaiModel: string;
  temperature: number;
  maxTokens: number;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [aiStatus, setAiStatus] = useState<AISettingsStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // 编辑状态
  const [aiProvider, setAiProvider] = useState("deepseek");
  const [deepseekApiKey, setDeepseekApiKey] = useState("");
  const [deepseekModel, setDeepseekModel] = useState("");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [openaiModel, setOpenaiModel] = useState("");
  const [temperature, setTemperature] = useState("0.7");
  const [maxTokens, setMaxTokens] = useState("4096");
  const [keyEdited, setKeyEdited] = useState<Set<string>>(new Set());

  function loadSettings(data: { settings: Settings; aiStatus: AISettingsStatus }) {
    const s = data.settings;
    setSettings(s);
    setAiStatus(data.aiStatus);
    setAiProvider(s.aiProvider);
    setDeepseekApiKey(s.deepseekApiKey);
    setDeepseekModel(s.deepseekModel);
    setOpenaiApiKey(s.openaiApiKey);
    setOpenaiModel(s.openaiModel);
    setTemperature(String(s.temperature));
    setMaxTokens(String(s.maxTokens));
  }

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(loadSettings);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setMessage("");

    const updates: Record<string, unknown> = {
      aiProvider,
      deepseekModel: deepseekModel || undefined,
      openaiModel: openaiModel || undefined,
      temperature: Number(temperature),
      maxTokens: Number(maxTokens),
    };

    // Only include API key if edited
    if (keyEdited.has("deepseek")) {
      updates.deepseekApiKey = deepseekApiKey || undefined;
    }
    if (keyEdited.has("openai")) {
      updates.openaiApiKey = openaiApiKey || undefined;
    }

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("保存失败");
      const data = await res.json();
      loadSettings(data);
      setKeyEdited(new Set());
      setMessage("已保存");
      setTimeout(() => setMessage(""), 2000);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }, [aiProvider, deepseekApiKey, deepseekModel, openaiApiKey, openaiModel, temperature, maxTokens, keyEdited]);

  if (!settings) {
    return (
      <main className="max-w-2xl mx-auto px-8 py-12">
        <p className="text-sm text-gray-400">加载中...</p>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-8 py-12">
      <Link href="/" className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition mb-8">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        返回首页
      </Link>
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-2">AI 模型设置</h1>
      <p className="text-sm text-gray-500 mb-4">配置 AI 服务商和模型参数。API Key 加密存储，仅用于调用 AI 服务。</p>

      {/* AI 配置状态 */}
      {aiStatus && (
        <div className={`rounded-lg border px-4 py-3 mb-6 ${
          aiStatus.configured
            ? "border-green-200 bg-green-50 text-green-700"
            : "border-amber-200 bg-amber-50 text-amber-700"
        }`}>
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${aiStatus.configured ? "bg-green-500" : "bg-amber-500"}`} />
            <p className="text-sm font-medium">
              {aiStatus.configured ? "AI 配置就绪" : "AI 配置未完成"}
            </p>
          </div>
          <p className="text-xs mt-1 ml-4">{aiStatus.message}</p>
          {!aiStatus.configured && (
            <p className="text-xs mt-1 ml-4">
              设置完成前，采集素材以外的 AI 功能将不可用。
            </p>
          )}
        </div>
      )}

      {/* AI Provider */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 mb-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500 mb-4">AI 服务商</h2>
        <div className="flex gap-3">
          {["deepseek", "openai"].map((p) => (
            <button
              key={p}
              onClick={() => setAiProvider(p)}
              className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
                aiProvider === p
                  ? "border-blue-300 bg-blue-50 text-blue-700"
                  : "border-gray-200 text-gray-500 hover:bg-gray-50"
              }`}
            >
              {p === "deepseek" ? "DeepSeek" : "OpenAI"}
            </button>
          ))}
        </div>
      </section>

      {/* DeepSeek Settings */}
      {aiProvider === "deepseek" && (
        <section className="rounded-xl border border-gray-200 bg-white p-6 mb-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500 mb-4">DeepSeek 配置</h2>
          <label className="block mb-4">
            <span className="text-sm font-medium text-gray-700">API Key</span>
            <input
              type="password"
              value={deepseekApiKey}
              onChange={(e) => { setDeepseekApiKey(e.target.value); setKeyEdited((s) => new Set(s).add("deepseek")); }}
              onFocus={() => setKeyEdited((s) => new Set(s).add("deepseek"))}
              placeholder={settings.deepseekApiKey ? "已设置 (不修改则留空)" : "sk-..."}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-mono outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
            />
            <span className="text-xs text-gray-400 mt-0.5 block">
              {settings.deepseekApiKey ? `当前: ${settings.deepseekApiKey}` : "未设置，将使用环境变量"}
            </span>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Model</span>
            <input
              value={deepseekModel}
              onChange={(e) => setDeepseekModel(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
            />
          </label>
        </section>
      )}

      {/* OpenAI Settings */}
      {aiProvider === "openai" && (
        <section className="rounded-xl border border-gray-200 bg-white p-6 mb-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500 mb-4">OpenAI 配置</h2>
          <label className="block mb-4">
            <span className="text-sm font-medium text-gray-700">API Key</span>
            <input
              type="password"
              value={openaiApiKey}
              onChange={(e) => { setOpenaiApiKey(e.target.value); setKeyEdited((s) => new Set(s).add("openai")); }}
              onFocus={() => setKeyEdited((s) => new Set(s).add("openai"))}
              placeholder={settings.openaiApiKey ? "已设置 (不修改则留空)" : "sk-..."}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-mono outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
            />
            <span className="text-xs text-gray-400 mt-0.5 block">
              {settings.openaiApiKey ? `当前: ${settings.openaiApiKey}` : "未设置，将使用环境变量"}
            </span>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Model</span>
            <input
              value={openaiModel}
              onChange={(e) => setOpenaiModel(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
            />
          </label>
        </section>
      )}

      {/* General AI Params */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 mb-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500 mb-4">生成参数</h2>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Temperature</span>
            <input
              type="number"
              step="0.1"
              min="0"
              max="2"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
            />
            <span className="text-xs text-gray-400 mt-0.5 block">0 = 确定性，2 = 高创造性</span>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Max Tokens</span>
            <input
              type="number"
              min="1"
              max="128000"
              value={maxTokens}
              onChange={(e) => setMaxTokens(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
            />
          </label>
        </div>
      </section>

      {message && (
        <p className={`rounded-lg px-3 py-2 text-xs font-medium mb-4 ${
          message === "已保存" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
        }`}>{message}</p>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 transition disabled:opacity-50"
      >
        {saving ? "保存中..." : "保存设置"}
      </button>
    </main>
  );
}
