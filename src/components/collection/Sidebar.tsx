"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type Area = { id: string; name: string; userId: string };
type Collection = { id: string; name: string; areaId: string | null; userId: string };

type Props = {
  userId: string;
  activeAreaId: string | null;
  activeCollectionId: string | null;
  onAreaChange: (area: Area) => void;
  onCollectionChange: (collection: Collection) => void;
};

function emitCollectionChange(collection: Collection) {
  localStorage.setItem("knowledgecast_collection_id", collection.id);
  window.dispatchEvent(new CustomEvent("collection-changed", { detail: collection }));
}

export function Sidebar({
  userId,
  activeAreaId,
  activeCollectionId,
  onAreaChange,
  onCollectionChange
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [areas, setAreas] = useState<Area[]>([]);
  const [collections, setCollections] = useState<Record<string, Collection[]>>({});
  const [collapsedAreas, setCollapsedAreas] = useState<Set<string>>(new Set());
  const [creatingArea, setCreatingArea] = useState(false);
  const [creatingCollection, setCreatingCollection] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const [dragItem, setDragItem] = useState<
    { type: "area"; id: string } | { type: "collection"; id: string; areaId: string } | null
  >(null);

  async function handleReorderAreas(ordered: Area[]) {
    setAreas(ordered);
    await fetch("/api/areas", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: ordered.map((a) => a.id) })
    });
  }

  async function handleReorderCollections(areaId: string, ordered: Collection[]) {
    setCollections((prev) => ({ ...prev, [areaId]: ordered }));
    await fetch("/api/collections", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: ordered.map((collection) => collection.id) })
    });
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function onDropArea(targetAreaId: string) {
    if (!dragItem) return;
    if (dragItem.type === "area" && dragItem.id !== targetAreaId) {
      const idx = areas.findIndex((a) => a.id === dragItem.id);
      const targetIdx = areas.findIndex((a) => a.id === targetAreaId);
      if (idx < 0 || targetIdx < 0) return;
      const next = [...areas];
      const [moved] = next.splice(idx, 1);
      next.splice(targetIdx, 0, moved);
      handleReorderAreas(next);
    }
    if (dragItem.type === "collection" && dragItem.areaId !== targetAreaId) {
      // 跨工作区移动工作集
      const srcArea = dragItem.areaId;
      const sourceCollections = collections[srcArea] ?? [];
      const collection = sourceCollections.find((item) => item.id === dragItem.id);
      if (!collection) return;
      const nextSrc = sourceCollections.filter((item) => item.id !== dragItem.id);
      const nextDst = [...(collections[targetAreaId] ?? []), { ...collection, areaId: targetAreaId }];
      setCollections((prev) => ({ ...prev, [srcArea]: nextSrc, [targetAreaId]: nextDst }));
      fetch(`/api/collections/${collection.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ areaId: targetAreaId })
      });
    }
    setDragItem(null);
  }

  function onDropCollection(targetCollectionId: string, targetAreaId: string) {
    if (!dragItem || dragItem.type !== "collection") return;
    if (dragItem.id === targetCollectionId) { setDragItem(null); return; }
    const list = [...(collections[targetAreaId] ?? [])];
    const idx = list.findIndex((item) => item.id === dragItem.id);
    const targetIdx = list.findIndex((item) => item.id === targetCollectionId);
    if (idx < 0 || targetIdx < 0) { setDragItem(null); return; }
    const [moved] = list.splice(idx, 1);
    list.splice(targetIdx, 0, moved);
    handleReorderCollections(targetAreaId, list);
    setDragItem(null);
  }

  const loadData = useCallback(async () => {
    const areasRes = await fetch(`/api/areas?userId=${encodeURIComponent(userId)}`);
    const areasData = await areasRes.json();
    const areaList = (areasData.areas ?? []) as Area[];
    setAreas(areaList);

    if (areaList.length > 0 && !activeAreaId) {
      onAreaChange(areaList[0]);
    }

    const collectionMap: Record<string, Collection[]> = {};
    let firstCollection: Collection | null = null;
    for (const area of areaList) {
      const collectionRes = await fetch(
        `/api/collections?userId=${encodeURIComponent(userId)}&areaId=${encodeURIComponent(area.id)}`
      );
      const collectionData = await collectionRes.json();
      collectionMap[area.id] = (collectionData.collections ?? []) as Collection[];
      if (!firstCollection && collectionMap[area.id].length > 0) {
        firstCollection = collectionMap[area.id][0];
      }
    }
    setCollections(collectionMap);

    // 首次加载，无选中工作集时，同步状态但不跳转（服务端已处理跳转）
    if (!activeCollectionId && firstCollection) {
      onCollectionChange(firstCollection);
      emitCollectionChange(firstCollection);
    }
  }, [userId, activeAreaId]);

  useEffect(() => {
    loadData();
  }, []);

  // Reload collections when area changes
  useEffect(() => {
    const handler = () => loadData();
    window.addEventListener("sidebar-refresh", handler);
    return () => window.removeEventListener("sidebar-refresh", handler);
  }, [loadData]);

  async function handleCreateArea() {
    if (!newName.trim()) return;
    const res = await fetch("/api/areas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, name: newName.trim() })
    });
    if (res.ok) {
      const data = await res.json();
      const area = data.area as Area;
      setAreas((prev) => [...prev, area]);
      setCollections((prev) => ({ ...prev, [area.id]: [] }));
      setCollapsedAreas((prev) => {
        prev.delete(area.id);
        return new Set(prev);
      });
      setNewName("");
      setCreatingArea(false);
    }
  }

  async function handleCreateCollection(areaId: string) {
    if (!newName.trim()) return;
    const res = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, areaId, name: newName.trim() })
    });
    if (res.ok) {
      const data = await res.json();
      const collection = data.collection as Collection;
      setCollections((prev) => ({
        ...prev,
        [areaId]: [...(prev[areaId] ?? []), collection]
      }));
      onCollectionChange(collection);
      emitCollectionChange(collection);
      setNewName("");
      setCreatingCollection(null);
      router.push(`/collections/${collection.id}`);
    }
  }

  async function handleRename(type: "area" | "collection", id: string) {
    if (!editName.trim()) { setEditingId(null); return; }
    const base = type === "area" ? "areas" : "collections";
    await fetch(`/api/${base}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim() })
    });
    if (type === "area") {
      setAreas((prev) => prev.map((a) => (a.id === id ? { ...a, name: editName.trim() } : a)));
    } else {
      const currentActiveCollection =
        activeCollectionId === id
          ? Object.values(collections).flat().find((item) => item.id === id) ?? null
          : null;
      setCollections((prev) => {
        const next = { ...prev };
        for (const aid of Object.keys(next)) {
          next[aid] = next[aid].map((item) =>
            item.id === id ? { ...item, name: editName.trim() } : item
          );
        }
        return next;
      });
      if (currentActiveCollection) {
        const renamed = { ...currentActiveCollection, name: editName.trim() };
        onCollectionChange(renamed);
        emitCollectionChange(renamed);
      }
    }
    setEditingId(null);
  }

  async function handleDelete(type: "area" | "collection", id: string) {
    const label = type === "area" ? "确定删除此工作区？其下的工作集仍会保留。" : "确定删除此工作集？素材不会丢失但会失去归属。";
    if (!confirm(label)) return;
    const base = type === "area" ? "areas" : "collections";
    await fetch(`/api/${base}/${id}`, { method: "DELETE" });
    if (type === "area") {
      setAreas((prev) => prev.filter((a) => a.id !== id));
      setCollections((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } else {
      setCollections((prev) => {
        const next = { ...prev };
        for (const aid of Object.keys(next)) {
          next[aid] = next[aid].filter((item) => item.id !== id);
        }
        return next;
      });
    }
  }

  function selectCollection(collection: Collection) {
    onCollectionChange(collection);
    if (collection.areaId) {
      const area = areas.find((a) => a.id === collection.areaId);
      if (area) onAreaChange(area);
    }
    emitCollectionChange(collection);
    router.push(`/collections/${collection.id}`);
  }

  return (
    <aside className="w-60 shrink-0 border-r border-gray-200 bg-white overflow-y-auto" ref={menuRef}>
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
        {areas.map((area) => {
          const collapsed = collapsedAreas.has(area.id);
          const areaCollections = collections[area.id] ?? [];
          const editing = editingId === area.id;

          return (
            <div key={area.id}>
              {/* Area header */}
              <div
                className="group flex items-center gap-1 rounded-lg bg-gray-100/50 px-2 py-2 hover:bg-gray-100 cursor-grab active:cursor-grabbing"
                draggable
                onDragStart={() => setDragItem({ type: "area", id: area.id })}
                onDragOver={onDragOver}
                onDrop={() => onDropArea(area.id)}
                onDragEnd={() => setDragItem(null)}
              >
                <button
                  onClick={() =>
                    setCollapsedAreas((prev) => {
                      const next = new Set(prev);
                      collapsed ? next.delete(area.id) : next.add(area.id);
                      return next;
                    })
                  }
                  className="p-0.5 text-gray-400 hover:text-gray-600"
                >
                  <svg
                    className={`h-3 w-3 transition ${collapsed ? "" : "rotate-90"}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {editing ? (
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename("area", area.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    onBlur={() => handleRename("area", area.id)}
                    className="flex-1 rounded border border-blue-300 px-1.5 py-0.5 text-xs outline-none"
                  />
                ) : (
                  <span className="flex-1 text-sm font-medium text-gray-800 truncate">
                    {area.name}
                  </span>
                )}

                <button
                  onClick={() => { setEditingId(area.id); setEditName(area.name); }}
                  className="hidden group-hover:block p-0.5 text-gray-300 hover:text-gray-500"
                  title="改名"
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                {areas.length > 1 && (
                  <button
                    onClick={() => handleDelete("area", area.id)}
                    className="hidden group-hover:block p-0.5 text-gray-300 hover:text-red-500"
                    title="删除"
                  >
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Collections under this area */}
              {!collapsed && (
                <div className="ml-4 space-y-0.5">
                  {areaCollections.map((collection) => {
                    const active = activeCollectionId === collection.id && pathname !== "/unassigned";
                    const editing = editingId === collection.id;
                    return (
                      <div key={collection.id}
                        className="group flex items-center rounded-lg hover:bg-gray-50 cursor-grab active:cursor-grabbing"
                        draggable
                        onDragStart={(e) => { e.stopPropagation(); setDragItem({ type: "collection", id: collection.id, areaId: area.id }); }}
                        onDragOver={onDragOver}
                        onDrop={() => onDropCollection(collection.id, area.id)}
                        onDragEnd={() => setDragItem(null)}
                      >
                        {editing ? (
                          <input
                            autoFocus
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleRename("collection", collection.id);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            onBlur={() => handleRename("collection", collection.id)}
                            className="flex-1 rounded border border-blue-300 px-1.5 py-0.5 text-xs outline-none mx-2"
                          />
                        ) : (
                          <button
                            onClick={() => selectCollection(collection)}
                            className={`flex-1 rounded-md px-2 py-1.5 text-left text-sm transition ${
                              active
                                ? "bg-blue-50 text-blue-700 font-medium"
                                : "text-gray-600"
                            }`}
                          >
                            {collection.name}
                          </button>
                        )}
                        {!editing && (
                          <>
                            <button
                              onClick={() => { setEditingId(collection.id); setEditName(collection.name); }}
                              className="hidden group-hover:block p-0.5 text-gray-300 hover:text-gray-500"
                            >
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            {areaCollections.length > 1 && (
                              <button
                                onClick={() => handleDelete("collection", collection.id)}
                                className="hidden group-hover:block p-0.5 text-gray-300 hover:text-red-500 mr-1"
                              >
                                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}

                  {/* New collection input */}
                  {creatingCollection === area.id ? (
                    <div className="flex gap-1 px-2">
                      <input
                        autoFocus
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleCreateCollection(area.id);
                          if (e.key === "Escape") { setCreatingCollection(null); setNewName(""); }
                        }}
                        onBlur={() => { setCreatingCollection(null); setNewName(""); }}
                        placeholder="工作集名称"
                        className="flex-1 rounded border border-blue-300 px-1.5 py-0.5 text-xs outline-none"
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() => setCreatingCollection(area.id)}
                      className="w-full rounded-md px-2 py-1 text-left text-xs text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                    >
                      + 新建工作集
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* New area input */}
        {creatingArea ? (
          <div className="flex gap-1 px-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateArea();
                if (e.key === "Escape") { setCreatingArea(false); setNewName(""); }
              }}
              onBlur={() => { setCreatingArea(false); setNewName(""); }}
              placeholder="工作区名称"
              className="flex-1 rounded border border-blue-300 px-1.5 py-0.5 text-xs outline-none"
            />
          </div>
        ) : (
          <button
            onClick={() => setCreatingArea(true)}
            className="w-full rounded-lg px-2 py-1.5 text-left text-xs text-gray-400 hover:bg-gray-50 hover:text-gray-600"
          >
            + 新建工作区
          </button>
        )}

        {/* 未归类素材 */}
        <div className="pt-3 mt-3 border-t border-gray-200">
          <Link
            href="/unassigned"
            className={`flex items-center gap-1.5 w-full rounded-lg px-2 py-1.5 text-left text-sm transition ${
              pathname === "/unassigned"
                ? "bg-blue-50 text-blue-700 font-medium"
                : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
            }`}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            未归类素材
          </Link>
        </div>

      </div>
    </aside>
  );
}
