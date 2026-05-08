"use client";

import { useCallback, useEffect, useState } from "react";
import { CaptureInput } from "@/components/collection/CaptureInput";
import { FragmentList } from "@/components/collection/FragmentList";

type Props = {
  collectionId: string;
  onAdvance: (phase: "organize") => void;
};

export function CaptureWorkspace({ collectionId, onAdvance }: Props) {
  const [userId] = useState("demo-user");
  const [refreshKey, setRefreshKey] = useState(0);
  const [fragmentCount, setFragmentCount] = useState(0);

  const loadCount = useCallback(() => {
    fetch(`/api/knowledge-items?userId=demo-user&collectionId=${encodeURIComponent(collectionId)}&limit=200`)
      .then((r) => r.json())
      .then((data) => {
        const active = (data.knowledgeItems ?? []).filter((i: { status: string }) => i.status !== "archived");
        setFragmentCount(active.length);
      });
  }, [collectionId]);

  useEffect(() => { loadCount(); }, [loadCount]);

  function handleCaptureDone() {
    setRefreshKey((k) => k + 1);
    loadCount();
  }

  return (
    <main className="px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">采集素材</h1>
          <p className="text-sm text-gray-500 mt-1">粘贴碎片知识、链接或 Markdown，系统自动识别类型并存入当前工作集</p>
        </div>
        {fragmentCount >= 3 && (
          <button
            onClick={() => onAdvance("organize")}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 transition"
          >
            开始整理 →
          </button>
        )}
      </div>
      {fragmentCount < 3 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700">
          建议至少添加 3 条素材后再开始整理，当前有 {fragmentCount} 条
        </div>
      )}
      <CaptureInput userId={userId} collectionId={collectionId} onDone={handleCaptureDone} />
      <FragmentList key={refreshKey} userId={userId} collectionId={collectionId} />
    </main>
  );
}
