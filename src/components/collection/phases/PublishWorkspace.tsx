"use client";

type Props = {
  collectionId: string;
  onAdvance: (phase: "iterate") => void;
};

export function PublishWorkspace({ collectionId, onAdvance }: Props) {
  return (
    <main className="px-8 py-8">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-2">可用版本</h1>
      <p className="text-sm text-gray-500 mb-6">查看和分享当前可用版本</p>
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
        <p className="text-sm text-gray-400">发布管理功能即将上线</p>
      </div>
    </main>
  );
}
