"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const actions = [
  { label: "采集", href: (id: string) => `/workspace/${id}/capture` },
  { label: "整理", href: (id: string) => `/workspace/${id}/structure` },
  { label: "发布", href: (id: string) => `/workspace/${id}/publish` },
  { label: "设置", href: (id: string) => `/workspace/${id}/settings` }
];

type Props = {
  workspaceId: string;
  workspaceName: string;
  areaName?: string;
};

export function ActionTabs({ workspaceId, workspaceName, areaName }: Props) {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-3 mb-4">
      {/* 面包屑 */}
      <div className="flex items-center gap-1.5 text-sm text-gray-400 shrink-0">
        {areaName && (
          <>
            <span>{areaName}</span>
            <span>/</span>
          </>
        )}
        <Link
          href={`/workspace/${workspaceId}`}
          className="hover:text-gray-700 transition font-medium text-gray-600"
        >
          {workspaceName}
        </Link>
      </div>

      {/* 分割 */}
      <div className="h-4 w-px bg-gray-300" />

      {/* 操作标签 */}
      <nav className="flex items-center gap-1">
        {actions.map((a) => {
          const href = a.href(workspaceId);
          const active = pathname === href;
          return (
            <Link
              key={a.label}
              href={href}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                active
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
              }`}
            >
              {a.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
