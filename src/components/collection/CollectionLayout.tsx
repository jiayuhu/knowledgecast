"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { CollectionNav } from "./CollectionNav";

type Area = { id: string; name: string; userId: string };
type Collection = { id: string; name: string; areaId: string | null; userId: string };

export function CollectionLayout({
  children,
  phase,
  structurePanel,
  contextPanel,
}: {
  children: React.ReactNode;
  phase?: string;
  structurePanel?: React.ReactNode;
  contextPanel?: React.ReactNode;
}) {
  const [userId] = useState("demo-user");
  const [area, setArea] = useState<Area | null>(null);
  const [collection, setCollection] = useState<Collection | null>(null);

  useEffect(() => {
    const savedId =
      localStorage.getItem("knowledgecast_collection_id") ??
      localStorage.getItem("knowledgecast_workspace_id");
    if (savedId) {
      fetch("/api/collections?userId=demo-user")
        .then((r) => r.json())
        .then((data) => {
          const list = (data.collections ?? []) as Collection[];
          const found = list.find((w) => w.id === savedId);
          if (found) setCollection(found);
        });
    }
  }, []);

  useEffect(() => {
    async function onCollectionChanged(event: Event) {
      const next = (event as CustomEvent<Collection>).detail;
      if (next?.id) {
        setCollection(next);
        if (next.areaId) {
          const response = await fetch(`/api/areas?userId=${encodeURIComponent(userId)}`);
          const data = await response.json();
          const areas = (data.areas ?? []) as Area[];
          setArea(areas.find((item) => item.id === next.areaId) ?? null);
        } else {
          setArea(null);
        }
      }
    }

    window.addEventListener("collection-changed", onCollectionChanged);
    return () => window.removeEventListener("collection-changed", onCollectionChanged);
  }, [userId]);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <CollectionNav
        collectionId={collection?.id}
        collectionName={collection?.name}
        areaName={area?.name}
        phase={phase}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          userId={userId}
          activeAreaId={area?.id ?? null}
          activeCollectionId={collection?.id ?? null}
          onAreaChange={setArea}
          onCollectionChange={setCollection}
        />
        {structurePanel && (
          <aside className="w-56 shrink-0 border-r border-gray-200 bg-white overflow-y-auto">
            {structurePanel}
          </aside>
        )}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
        {contextPanel && (
          <aside className="w-64 shrink-0 border-l border-gray-200 bg-white overflow-y-auto">
            {contextPanel}
          </aside>
        )}
      </div>
    </div>
  );
}
