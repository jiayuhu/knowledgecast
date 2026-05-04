"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Area = { id: string; name: string; userId: string };
type Workspace = { id: string; name: string; areaId: string | null; userId: string };

type Props = {
  userId: string;
  activeAreaId: string | null;
  activeWorkspaceId: string | null;
  onAreaChange: (area: Area) => void;
  onWorkspaceChange: (ws: Workspace) => void;
};

function emitWorkspaceChange(ws: Workspace) {
  localStorage.setItem("knowledgecast_workspace_id", ws.id);
  window.dispatchEvent(new CustomEvent("workspace-changed", { detail: ws }));
}

export function Sidebar({
  userId,
  activeAreaId,
  activeWorkspaceId,
  onAreaChange,
  onWorkspaceChange
}: Props) {
  const router = useRouter();
  const [areas, setAreas] = useState<Area[]>([]);
  const [workspaces, setWorkspaces] = useState<Record<string, Workspace[]>>({});
  const [collapsedAreas, setCollapsedAreas] = useState<Set<string>>(new Set());
  const [creatingArea, setCreatingArea] = useState(false);
  const [creatingWs, setCreatingWs] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const [dragItem, setDragItem] = useState<{ type: "area"; id: string } | { type: "ws"; id: string; areaId: string } | null>(null);

  async function handleReorderAreas(ordered: Area[]) {
    setAreas(ordered);
    await fetch("/api/areas", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: ordered.map((a) => a.id) })
    });
  }

  async function handleReorderWorkspaces(areaId: string, ordered: Workspace[]) {
    setWorkspaces((prev) => ({ ...prev, [areaId]: ordered }));
    await fetch("/api/workspaces", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: ordered.map((w) => w.id) })
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
    if (dragItem.type === "ws" && dragItem.areaId !== targetAreaId) {
      // 跨工作区移动工作集
      const srcArea = dragItem.areaId;
      const srcWs = workspaces[srcArea] ?? [];
      const ws = srcWs.find((w) => w.id === dragItem.id);
      if (!ws) return;
      const nextSrc = srcWs.filter((w) => w.id !== dragItem.id);
      const nextDst = [...(workspaces[targetAreaId] ?? []), { ...ws, areaId: targetAreaId }];
      setWorkspaces((prev) => ({ ...prev, [srcArea]: nextSrc, [targetAreaId]: nextDst }));
      fetch(`/api/workspaces/${ws.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ areaId: targetAreaId })
      });
    }
    setDragItem(null);
  }

  function onDropWs(targetWsId: string, targetAreaId: string) {
    if (!dragItem || dragItem.type !== "ws") return;
    if (dragItem.id === targetWsId) { setDragItem(null); return; }
    const list = [...(workspaces[targetAreaId] ?? [])];
    const idx = list.findIndex((w) => w.id === dragItem.id);
    const targetIdx = list.findIndex((w) => w.id === targetWsId);
    if (idx < 0 || targetIdx < 0) { setDragItem(null); return; }
    const [moved] = list.splice(idx, 1);
    list.splice(targetIdx, 0, moved);
    handleReorderWorkspaces(targetAreaId, list);
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

    const wsMap: Record<string, Workspace[]> = {};
    let firstWs: Workspace | null = null;
    for (const area of areaList) {
      const wsRes = await fetch(
        `/api/workspaces?userId=${encodeURIComponent(userId)}&areaId=${encodeURIComponent(area.id)}`
      );
      const wsData = await wsRes.json();
      wsMap[area.id] = (wsData.workspaces ?? []) as Workspace[];
      if (!firstWs && wsMap[area.id].length > 0) {
        firstWs = wsMap[area.id][0];
      }
    }
    setWorkspaces(wsMap);

    // 首次加载，无选中工作集时，同步状态但不跳转（服务端已处理跳转）
    if (!activeWorkspaceId && firstWs) {
      onWorkspaceChange(firstWs);
      emitWorkspaceChange(firstWs);
    }
  }, [userId, activeAreaId]);

  useEffect(() => {
    loadData();
  }, []);

  // Reload workspaces when area changes
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
      setWorkspaces((prev) => ({ ...prev, [area.id]: [] }));
      setCollapsedAreas((prev) => {
        prev.delete(area.id);
        return new Set(prev);
      });
      setNewName("");
      setCreatingArea(false);
    }
  }

  async function handleCreateWs(areaId: string) {
    if (!newName.trim()) return;
    const res = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, areaId, name: newName.trim() })
    });
    if (res.ok) {
      const data = await res.json();
      const ws = data.workspace as Workspace;
      setWorkspaces((prev) => ({
        ...prev,
        [areaId]: [...(prev[areaId] ?? []), ws]
      }));
      onWorkspaceChange(ws);
      setNewName("");
      setCreatingWs(null);
    }
  }

  async function handleRename(type: "area" | "ws", id: string) {
    if (!editName.trim()) { setEditingId(null); return; }
    const base = type === "area" ? "areas" : "workspaces";
    await fetch(`/api/${base}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim() })
    });
    if (type === "area") {
      setAreas((prev) => prev.map((a) => (a.id === id ? { ...a, name: editName.trim() } : a)));
    } else {
      setWorkspaces((prev) => {
        const next = { ...prev };
        for (const aid of Object.keys(next)) {
          next[aid] = next[aid].map((w) =>
            w.id === id ? { ...w, name: editName.trim() } : w
          );
        }
        return next;
      });
    }
    setEditingId(null);
  }

  async function handleDelete(type: "area" | "ws", id: string) {
    const label = type === "area" ? "确定删除此工作区？其下的工作集仍会保留。" : "确定删除此工作集？素材不会丢失但会失去归属。";
    if (!confirm(label)) return;
    const base = type === "area" ? "areas" : "workspaces";
    await fetch(`/api/${base}/${id}`, { method: "DELETE" });
    if (type === "area") {
      setAreas((prev) => prev.filter((a) => a.id !== id));
      setWorkspaces((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } else {
      setWorkspaces((prev) => {
        const next = { ...prev };
        for (const aid of Object.keys(next)) {
          next[aid] = next[aid].filter((w) => w.id !== id);
        }
        return next;
      });
    }
  }

  function selectWorkspace(ws: Workspace) {
    onWorkspaceChange(ws);
    emitWorkspaceChange(ws);
    router.push(`/workspace/${ws.id}`);
  }

  return (
    <aside className="w-60 shrink-0 border-r border-gray-200 bg-white overflow-y-auto" ref={menuRef}>
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
        {areas.map((area) => {
          const collapsed = collapsedAreas.has(area.id);
          const areaWs = workspaces[area.id] ?? [];
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

              {/* Workpaces under this area */}
              {!collapsed && (
                <div className="ml-4 space-y-0.5">
                  {areaWs.map((ws) => {
                    const active = activeWorkspaceId === ws.id;
                    const editing = editingId === ws.id;
                    return (
                      <div key={ws.id}
                        className="group flex items-center rounded-lg hover:bg-gray-50 cursor-grab active:cursor-grabbing"
                        draggable
                        onDragStart={(e) => { e.stopPropagation(); setDragItem({ type: "ws", id: ws.id, areaId: area.id }); }}
                        onDragOver={onDragOver}
                        onDrop={() => onDropWs(ws.id, area.id)}
                        onDragEnd={() => setDragItem(null)}
                      >
                        {editing ? (
                          <input
                            autoFocus
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleRename("ws", ws.id);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            onBlur={() => handleRename("ws", ws.id)}
                            className="flex-1 rounded border border-blue-300 px-1.5 py-0.5 text-xs outline-none mx-2"
                          />
                        ) : (
                          <button
                            onClick={() => selectWorkspace(ws)}
                            className={`flex-1 rounded-md px-2 py-1.5 text-left text-sm transition ${
                              active
                                ? "bg-blue-50 text-blue-700 font-medium"
                                : "text-gray-600"
                            }`}
                          >
                            {ws.name}
                          </button>
                        )}
                        {!editing && (
                          <>
                            <button
                              onClick={() => { setEditingId(ws.id); setEditName(ws.name); }}
                              className="hidden group-hover:block p-0.5 text-gray-300 hover:text-gray-500"
                            >
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            {areaWs.length > 1 && (
                              <button
                                onClick={() => handleDelete("ws", ws.id)}
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

                  {/* New workspace input */}
                  {creatingWs === area.id ? (
                    <div className="flex gap-1 px-2">
                      <input
                        autoFocus
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleCreateWs(area.id);
                          if (e.key === "Escape") { setCreatingWs(null); setNewName(""); }
                        }}
                        onBlur={() => { setCreatingWs(null); setNewName(""); }}
                        placeholder="工作集名称"
                        className="flex-1 rounded border border-blue-300 px-1.5 py-0.5 text-xs outline-none"
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() => setCreatingWs(area.id)}
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
      </div>
    </aside>
  );
}
