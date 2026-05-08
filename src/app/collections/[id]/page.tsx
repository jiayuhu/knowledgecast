"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CollectionLayout } from "@/components/collection/CollectionLayout";
import { CaptureWorkspace } from "@/components/collection/phases/CaptureWorkspace";
import { OrganizeWorkspace } from "@/components/collection/phases/OrganizeWorkspace";
import { CreateWorkspace } from "@/components/collection/phases/CreateWorkspace";
import { PublishWorkspace } from "@/components/collection/phases/PublishWorkspace";
import { IterateWorkspace } from "@/components/collection/phases/IterateWorkspace";

type Phase = "capture" | "organize" | "create" | "publish" | "iterate";

type Collection = { id: string; name: string; areaId: string | null; topic?: string | null; userId: string; phase?: string };

export default function TaskPage() {
  const { id } = useParams<{ id: string }>();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [phase, setPhase] = useState<Phase>("capture");
  const [loading, setLoading] = useState(true);

  const loadCollection = useCallback(() => {
    fetch("/api/collections?userId=demo-user")
      .then((r) => r.json())
      .then((data) => {
        const next = (data.collections as Collection[]).find((item) => item.id === id) ?? null;
        setCollection(next);
        if (next?.phase && ["capture", "organize", "create", "publish", "iterate"].includes(next.phase)) {
          setPhase(next.phase as Phase);
        }
        if (next) localStorage.setItem("knowledgecast_collection_id", next.id);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { loadCollection(); }, [loadCollection]);

  async function advancePhase(nextPhase: Phase) {
    setPhase(nextPhase);
    await fetch(`/api/collections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phase: nextPhase })
    });
  }

  function renderWorkspace() {
    if (!collection) return null;
    switch (phase) {
      case "capture":
        return <CaptureWorkspace collectionId={collection.id} onAdvance={(p) => advancePhase(p)} />;
      case "organize":
        return <OrganizeWorkspace collectionId={collection.id} onAdvance={(p) => advancePhase(p)} />;
      case "create":
        return <CreateWorkspace collectionId={collection.id} onAdvance={(p) => advancePhase(p)} />;
      case "publish":
        return <PublishWorkspace collectionId={collection.id} onAdvance={(p) => advancePhase(p)} />;
      case "iterate":
        return <IterateWorkspace collectionId={collection.id} onAdvance={(p) => advancePhase(p)} />;
    }
  }

  if (loading) {
    return (
      <CollectionLayout phase={phase}>
        <main className="px-8 py-8"><p className="text-sm text-gray-400">加载中...</p></main>
      </CollectionLayout>
    );
  }

  if (!collection) {
    return (
      <CollectionLayout phase={phase}>
        <main className="px-8 py-8"><p className="text-sm text-gray-400">工作集未找到</p></main>
      </CollectionLayout>
    );
  }

  return (
    <CollectionLayout phase={phase}>
      {renderWorkspace()}
    </CollectionLayout>
  );
}
