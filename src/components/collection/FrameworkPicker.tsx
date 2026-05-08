"use client";

import { useEffect, useState } from "react";

type Framework = {
  id: string;
  name: string;
  structure: string[];
  description: string;
  icon: string;
  isCustom?: boolean;
};

type Props = {
  userId: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

const iconMap: Record<string, string> = {
  lightbulb: "💡",
  book: "📖",
  chat: "💬",
  wrench: "🔧",
  package: "📦",
  custom: "✏️"
};

export function FrameworkPicker({ userId, selectedId, onSelect }: Props) {
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [customs, setCustoms] = useState<Framework[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [fwName, setFwName] = useState("");
  const [fwSteps, setFwSteps] = useState("");
  const [fwDesc, setFwDesc] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadFrameworks(); }, []);

  async function loadFrameworks() {
    const r = await fetch(`/api/frameworks?userId=${encodeURIComponent(userId)}`);
    const data = await r.json();
    const all = (data.frameworks ?? []) as Framework[];
    setFrameworks(all.filter((f) => !f.isCustom));
    setCustoms(all.filter((f) => f.isCustom));
  }

  function resetEditor() {
    setShowEditor(false);
    setEditId(null);
    setFwName("");
    setFwSteps("");
    setFwDesc("");
  }

  function startEdit(fw: Framework) {
    setEditId(fw.id);
    setFwName(fw.name);
    setFwSteps(fw.structure.join("、"));
    setFwDesc(fw.description);
    setShowEditor(true);
  }

  async function handleSave() {
    if (!fwName.trim() || !fwSteps.trim()) return;
    setSaving(true);
    const structure = fwSteps.split(/[、,，]/).map((s) => s.trim()).filter(Boolean);

    if (editId) {
      await fetch(`/api/frameworks/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: fwName.trim(), structure, description: fwDesc.trim() || null })
      });
    } else {
      await fetch("/api/frameworks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, name: fwName.trim(), structure, description: fwDesc.trim() })
      });
    }
    await loadFrameworks();
    resetEditor();
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/frameworks/${id}`, { method: "DELETE" });
    if (selectedId === id) onSelect("");
    await loadFrameworks();
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">选择培训框架</h2>
        <span className="text-xs text-gray-400">{frameworks.length + customs.length} 套</span>
      </div>

      {/* 内置模板 */}
      <div className="mt-4 space-y-2">
        {frameworks.map((fw) => {
          const active = selectedId === fw.id;
          return (
            <button key={fw.id} onClick={() => onSelect(fw.id)}
              className={`w-full rounded-lg border p-3 text-left transition ${
                active ? "border-blue-300 bg-blue-50 ring-1 ring-blue-200" : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"}`}>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-lg">{iconMap[fw.icon] ?? "📋"}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{fw.name}</span>
                    {active && <span className="rounded-md bg-blue-600 px-1.5 py-0.5 text-[10px] font-medium text-white">已选</span>}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {fw.structure.map((step, i) => (
                      <span key={step} className="flex items-center gap-1 text-xs text-gray-500">
                        {i > 0 && <span className="text-gray-300">→</span>}{step}
                      </span>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-gray-400">{fw.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 自定义模板 */}
      {customs.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400 mb-2">自定义模板</p>
          <div className="space-y-2">
            {customs.map((fw) => {
              const active = selectedId === fw.id;
              return (
                <div key={fw.id} className="group relative">
                  <button onClick={() => onSelect(fw.id)}
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      active ? "border-purple-300 bg-purple-50 ring-1 ring-purple-200" : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"}`}>
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 text-lg">✏️</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">{fw.name}</span>
                          {active && <span className="rounded-md bg-purple-600 px-1.5 py-0.5 text-[10px] font-medium text-white">已选</span>}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {fw.structure.map((step, i) => (
                            <span key={step} className="flex items-center gap-1 text-xs text-gray-500">
                              {i > 0 && <span className="text-gray-300">→</span>}{step}
                            </span>
                          ))}
                        </div>
                        {fw.description && <p className="mt-1 text-xs text-gray-400">{fw.description}</p>}
                      </div>
                    </div>
                  </button>
                  <div className="absolute right-2 top-2 hidden group-hover:flex gap-1">
                    <button onClick={(e) => { e.stopPropagation(); startEdit(fw); }}
                      className="rounded p-1 text-gray-300 hover:text-gray-500 hover:bg-gray-100">
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(fw.id); }}
                      className="rounded p-1 text-gray-300 hover:text-red-500 hover:bg-red-50">
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 新建/编辑自定义模板 */}
      {showEditor ? (
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
          <p className="text-xs font-medium text-gray-600">{editId ? "编辑模板" : "新建模板"}</p>
          <input value={fwName} onChange={(e) => setFwName(e.target.value)}
            placeholder="模板名称，如：故事叙述型"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-purple-400" />
          <input value={fwSteps} onChange={(e) => setFwSteps(e.target.value)}
            placeholder="步骤，用顿号分隔，如：起、承、转、合"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-purple-400" />
          <input value={fwDesc} onChange={(e) => setFwDesc(e.target.value)}
            placeholder="适用场景（可选）"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-purple-400" />
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving || !fwName.trim() || !fwSteps.trim()}
              className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50">
              {saving ? "保存中..." : "保存"}
            </button>
            <button onClick={resetEditor}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50">取消</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowEditor(true)}
          className="mt-4 w-full rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-400 hover:border-purple-300 hover:text-purple-600 transition">
          + 新建自定义模板
        </button>
      )}
    </div>
  );
}
