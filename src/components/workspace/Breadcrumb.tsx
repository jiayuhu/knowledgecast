import Link from "next/link";

type Props = {
  workspaceId: string;
  workspaceName: string;
  areaName?: string;
  currentPage: string;
};

export function Breadcrumb({ workspaceId, workspaceName, areaName, currentPage }: Props) {
  return (
    <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-6">
      {areaName && (
        <>
          <span>{areaName}</span>
          <span>/</span>
        </>
      )}
      <Link
        href={`/workspace/${workspaceId}`}
        className="hover:text-gray-700 transition"
      >
        {workspaceName}
      </Link>
      <span>/</span>
      <span className="text-gray-600">{currentPage}</span>
    </div>
  );
}
