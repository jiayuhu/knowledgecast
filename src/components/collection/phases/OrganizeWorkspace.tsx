"use client";

type Props = {
  collectionId: string;
  onAdvance: (phase: "create") => void;
};

export function OrganizeWorkspace({ collectionId, onAdvance }: Props) {
  return (
    <main className="px-8 py-8">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-2">整理内容</h1>
      <p className="text-sm text-gray-500 mb-6">选择培训框架，AI 根据素材生成内容骨架</p>
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
        <p className="text-sm text-gray-400">骨架整理功能即将上线</p>
      </div>
    </main>
  );
}
