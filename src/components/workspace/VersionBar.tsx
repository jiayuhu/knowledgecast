"use client";

import { useState, useEffect } from "react";

type VersionSummary = {
  id: string;
  version: number;
  instruction: string;
  createdAt: string; // ISO string from JSON serialization
};

type Props = {
  currentVersion: number;
  trainingPageId: string;
  currentSlidesJson: string | null;
  onVersionSelect: (slidesJson: string, version: number) => void;
  onRestore: (slidesJson: string, targetVersion: number) => void;
  hasManualEdits: boolean;
};

export function VersionBar({
  currentVersion,
  trainingPageId,
  currentSlidesJson,
  onVersionSelect,
  onRestore,
  hasManualEdits
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [viewingVersion, setViewingVersion] = useState<number | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    fetch(`/api/training-pages/${trainingPageId}/versions`)
      .then(r => r.json())
      .then(data => setVersions(data.versions ?? []))
      .catch(() => {});
  }, [trainingPageId]);

  const totalVersions = versions.length;

  function handleSelectVersion(v: VersionSummary) {
    setViewingVersion(v.version);
    fetch(`/api/training-pages/${trainingPageId}/versions/${v.id}`)
      .then(r => r.json())
      .then(data => {
        if (data.slidesJson) onVersionSelect(data.slidesJson, v.version);
      })
      .catch(() => {});
  }

  function handleBackToCurrent() {
    setViewingVersion(null);
    if (currentSlidesJson) onVersionSelect(currentSlidesJson, currentVersion);
  }

  function handlePrevious() {
    const idx = versions.findIndex(v => v.version === (viewingVersion ?? currentVersion));
    if (idx > 0) handleSelectVersion(versions[idx - 1]);
  }

  function handleNext() {
    const idx = versions.findIndex(v => v.version === (viewingVersion ?? currentVersion));
    if (viewingVersion === null) return; // already on latest
    if (idx >= 0 && idx < versions.length - 1) handleSelectVersion(versions[idx + 1]);
    if (idx === versions.length - 1) handleBackToCurrent();
  }

  async function handleRestore() {
    if (!viewingVersion || viewingVersion === currentVersion) return;
    setRestoring(true);
    const v = versions.find(v => v.version === viewingVersion);
    if (!v) return;
    try {
      const res = await fetch(`/api/training-pages/${trainingPageId}/versions/${v.id}`);
      const data = await res.json();
      if (data.slidesJson) {
        onRestore(data.slidesJson, viewingVersion);
      }
    } finally {
      setRestoring(false);
    }
  }

  if (totalVersions === 0) return null;

  const currentDisplay = viewingVersion ?? currentVersion;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      {hasManualEdits && (
        <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
          ⚠ 已手动编辑，部分 AI 迭代可能导致手动修改丢失
        </p>
      )}

      <div className="flex items-center gap-2 text-sm">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-gray-500 hover:text-gray-700 font-medium"
        >
          版本历史 {expanded ? "▾" : "▸"}
        </button>
        <span className="text-gray-400">
          v{currentDisplay} / 共 {totalVersions + 1} 个版本
        </span>
        <span className="text-gray-300">|</span>
        <button
          onClick={handlePrevious}
          disabled={viewingVersion !== null && versions.findIndex(v => v.version === viewingVersion) === 0}
          className="text-gray-500 hover:text-gray-700 disabled:opacity-30"
        >
          ◀ 上一个
        </button>
        <button
          onClick={handleNext}
          disabled={viewingVersion === null}
          className="text-gray-500 hover:text-gray-700 disabled:opacity-30"
        >
          下一个 ▶
        </button>
        {viewingVersion !== null && viewingVersion !== currentVersion && (
          <>
            <span className="text-gray-300">|</span>
            <button
              onClick={handleRestore}
              disabled={restoring}
              className="text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
            >
              {restoring ? "恢复中..." : "↻ 恢复此版本"}
            </button>
            <button
              onClick={handleBackToCurrent}
              className="text-gray-400 hover:text-gray-600"
            >
              回到最新
            </button>
          </>
        )}
      </div>

      {expanded && (
        <div className="border-t border-gray-100 pt-2 max-h-48 overflow-y-auto space-y-1">
          {versions.map((v) => (
            <button
              key={v.id}
              onClick={() => handleSelectVersion(v)}
              className={`w-full flex items-center gap-2 rounded-md px-3 py-1.5 text-left text-xs transition ${
                v.version === viewingVersion
                  ? "bg-blue-50 text-blue-700"
                  : v.version === currentVersion && viewingVersion === null
                    ? "bg-gray-50 text-gray-700"
                    : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              <span className="font-mono">
                {v.version === currentVersion && viewingVersion === null ? "●" : "○"} v{v.version}
              </span>
              <span className="text-gray-400">
                {new Date(v.createdAt).toLocaleString("zh-CN", {
                  month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
                })}
              </span>
              <span className="flex-1 truncate text-gray-500">
                指令：「{v.instruction.slice(0, 30)}{v.instruction.length > 30 ? "..." : ""}」
              </span>
            </button>
          ))}
          <button
            onClick={handleBackToCurrent}
            className={`w-full flex items-center gap-2 rounded-md px-3 py-1.5 text-left text-xs ${
              viewingVersion === null ? "bg-blue-50 text-blue-700" : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            <span className="font-mono">● v{currentVersion}</span>
            <span className="text-gray-400">当前版本</span>
          </button>
        </div>
      )}
    </div>
  );
}
