"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CaptureInput } from "@/components/collection/CaptureInput";
import { FragmentList } from "@/components/collection/FragmentList";

type Collection = { id: string; name: string; areaId: string | null; userId: string };
type Area = { id: string; name: string };

export default function CapturePage() {
  const { id } = useParams<{ id: string }>();
  const [userId] = useState("demo-user");
  const [collection, setCollection] = useState<Collection | null>(null);
  const [areaName, setAreaName] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const loadCollection = useCallback(() => {
    Promise.all([
      fetch(`/api/collections?userId=demo-user`),
      fetch("/api/areas?userId=demo-user")
    ])
      .then(async ([collectionRes, areaRes]) => {
        const collectionData = await collectionRes.json();
        const areaData = await areaRes.json();
        const nextCollection = (collectionData.collections as Collection[]).find((item) => item.id === id);
        setCollection(nextCollection ?? null);
        if (nextCollection?.areaId) {
          const area = (areaData.areas as Area[]).find((a) => a.id === nextCollection.areaId);
          setAreaName(area?.name ?? "");
        }
        if (nextCollection) localStorage.setItem("knowledgecast_collection_id", nextCollection.id);
      })
      .catch(() => {
        // 加载失败，collection 保持 null
      });
  }, [id]);

  useEffect(() => { loadCollection(); }, [loadCollection]);

  function handleCaptureDone() { setRefreshKey((k) => k + 1); }

  return (
    <main className="px-8 py-8">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-2">采集素材</h1>
      <p className="text-sm text-gray-500 mb-6">粘贴碎片知识、链接或 Markdown，系统自动识别类型并存入当前工作集</p>
      {collection ? (
        <>
          <CaptureInput userId={userId} collectionId={collection.id} onDone={handleCaptureDone} />
          <FragmentList key={refreshKey} userId={userId} collectionId={collection.id} />
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-sm text-gray-400">加载中...</p>
        </div>
      )}
    </main>
  );
}
