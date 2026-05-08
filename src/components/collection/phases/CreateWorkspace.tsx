"use client";

type Props = {
  collectionId: string;
  onAdvance: (phase: "publish") => void;
};

export function CreateWorkspace({ collectionId, onAdvance }: Props) {
  return (
    <main className="px-8 py-8">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-2">创作内容</h1>
      <p className="text-sm text-gray-500 mb-6">围绕骨架分段生成培训内容</p>
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
        <p className="text-sm text-gray-400">分段创作功能即将上线</p>
      </div>
    </main>
  );
}
