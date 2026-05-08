"use client";

type Props = {
  phase: string;
};

export function StructurePanel({ phase }: Props) {
  if (phase === "capture") {
    return (
      <div className="px-3 py-4">
        <h3 className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-3">材料列表</h3>
        <p className="text-xs text-gray-400">选择材料以查看详情</p>
      </div>
    );
  }

  if (phase === "organize" || phase === "create") {
    return (
      <div className="px-3 py-4">
        <h3 className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-3">内容骨架</h3>
        <p className="text-xs text-gray-400">骨架编辑功能即将上线</p>
      </div>
    );
  }

  if (phase === "publish" || phase === "iterate") {
    return (
      <div className="px-3 py-4">
        <h3 className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-3">版本结构</h3>
        <p className="text-xs text-gray-400">版本结构即将上线</p>
      </div>
    );
  }

  return null;
}
