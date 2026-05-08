"use client";

type Props = {
  collectionId: string;
  onAdvance: (phase: "capture") => void;
};

export function IterateWorkspace({ collectionId, onAdvance }: Props) {
  return (
    <main className="px-8 py-8">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-2">迭代</h1>
      <p className="text-sm text-gray-500 mb-6">基于新材料和反馈继续改进内容</p>
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
        <p className="text-sm text-gray-400">迭代功能即将上线</p>
      </div>
    </main>
  );
}
