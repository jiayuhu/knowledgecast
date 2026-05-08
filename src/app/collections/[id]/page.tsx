"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CollectionLayout } from "@/components/collection/CollectionLayout";
import { CaptureWorkspace } from "@/components/collection/phases/CaptureWorkspace";
import { OrganizeWorkspace } from "@/components/collection/phases/OrganizeWorkspace";
import { CreateWorkspace } from "@/components/collection/phases/CreateWorkspace";
import { PublishWorkspace } from "@/components/collection/phases/PublishWorkspace";
import { IterateWorkspace } from "@/components/collection/phases/IterateWorkspace";

const PHASES = ["capture", "organize", "create", "publish", "iterate"] as const;
type Phase = (typeof PHASES)[number];

type Collection = { id: string; name: string; areaId: string | null; topic?: string | null; userId: string; phase?: string };

export default function TaskPage() {
  const { id } = useParams<{ id: string }>();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [phase, setPhase] = useState<Phase>("capture");
  const [loading, setLoading] = useState(true);

  const loadCollection = useCallback(() => {
    fetch("/api/collections?userId=demo-user")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        const next = (data.collections as Collection[]).find((item) => item.id === id) ?? null;
        setCollection(next);
        if (next?.phase && PHASES.includes(next.phase as Phase)) {
          setPhase(next.phase as Phase);
        }
        if (next) localStorage.setItem("knowledgecast_collection_id", next.id);
      })
      .catch((err) => {
        console.error("Failed to load collection:", err);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { loadCollection(); }, [loadCollection]);

  const advancePhase = useCallback(async (nextPhase: Phase) => {
    const prevPhase = phase;
    setPhase(nextPhase);
    try {
      const res = await fetch(`/api/collections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: nextPhase }),
      });
      if (!res.ok) throw new Error(`PATCH failed: ${res.status}`);
    } catch (err) {
      console.error("advancePhase failed, rolling back:", err);
      setPhase(prevPhase);
    }
  }, [id, phase]);

  function renderWorkspace() {
    if (!collection) return null;
    switch (phase) {
      case "capture":
        return <CaptureWorkspace collectionId={collection.id} onAdvance={advancePhase} />;
      case "organize":
        return <OrganizeWorkspace collectionId={collection.id} onAdvance={advancePhase} />;
      case "create":
        return <CreateWorkspace collectionId={collection.id} onAdvance={advancePhase} />;
      case "publish":
        return <PublishWorkspace collectionId={collection.id} onAdvance={advancePhase} />;
      case "iterate":
        return <IterateWorkspace collectionId={collection.id} onAdvance={advancePhase} />;
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
