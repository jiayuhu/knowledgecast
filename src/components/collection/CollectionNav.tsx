"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="28" height="28" rx="6" fill="#2563eb"/>
      <path d="M7 11.5L14 7l7 4.5V18l-7 4.5L7 18V11.5z" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round"/>
      <circle cx="14" cy="14" r="2.5" fill="#fff"/>
      <line x1="14" y1="11.5" x2="14" y2="8" stroke="#fff" strokeWidth="1" strokeLinecap="round"/>
    </svg>
  );
}

const phaseLabels: Record<string, { label: string; color: string }> = {
  capture: { label: "采集", color: "bg-blue-100 text-blue-700" },
  organize: { label: "整理", color: "bg-purple-100 text-purple-700" },
  create: { label: "创作", color: "bg-amber-100 text-amber-700" },
  publish: { label: "可用", color: "bg-green-100 text-green-700" },
  iterate: { label: "迭代", color: "bg-gray-100 text-gray-700" },
};

type Props = {
  collectionId?: string;
  collectionName?: string;
  areaName?: string;
  phase?: string;
};

function UserMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="h-7 w-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-medium hover:bg-blue-700 transition"
      >
        Y
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-48 rounded-lg border border-gray-200 bg-white shadow-lg py-1 z-50">
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-900">Yuhooo</p>
            <p className="text-xs text-gray-400">demo@knowledgecast</p>
          </div>
          <Link
            href="/settings"
            className="block w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition"
            onClick={() => setOpen(false)}
          >
            AI 模型设置
          </Link>
          <button
            className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-gray-50 transition cursor-not-allowed"
            disabled
            title="多用户版本上线后可用"
          >
            退出登录
          </button>
        </div>
      )}
    </div>
  );
}

export function CollectionNav({ collectionId, collectionName, areaName, phase }: Props) {
  const pathname = usePathname();

  const isUnassigned = pathname === "/unassigned";
  const showContent = !isUnassigned && collectionId && collectionName;
  const phaseInfo = phase ? phaseLabels[phase] : undefined;

  return (
    <header className="shrink-0 border-b border-gray-200 bg-white">
      <div className="flex items-center px-6 py-2.5 gap-4">
        {/* 左侧：Logo + 名称 */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <Logo />
          <span className="text-base font-bold tracking-tight text-gray-900">
            KnowledgeCast
          </span>
        </Link>

        {/* 分隔 */}
        {(showContent || isUnassigned) && <div className="h-5 w-px bg-gray-200 shrink-0" />}

        {/* 未归类素材标识 */}
        {isUnassigned && (
          <div className="flex items-center gap-1.5 text-sm shrink-0">
            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            <span className="font-medium text-gray-600">未归类素材</span>
          </div>
        )}

        {/* 面包屑 + 阶段状态 */}
        {showContent && (
          <div className="flex items-center gap-1.5 text-sm text-gray-400 shrink-0">
            {areaName && (
              <>
                <span>{areaName}</span>
                <span>/</span>
              </>
            )}
            <Link
              href={`/collections/${collectionId}`}
              className="hover:text-gray-700 transition font-medium text-gray-600"
            >
              {collectionName}
            </Link>
            {phaseInfo && (
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${phaseInfo.color}`}>
                ● {phaseInfo.label}
              </span>
            )}
          </div>
        )}

        {/* 右侧：操作按钮 + 设置 + 用户菜单 */}
        <div className="flex items-center gap-2 ml-auto shrink-0">
          {showContent && !isUnassigned && (
            <Link
              href={`/collections/${collectionId}/capture`}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition"
            >
              + 新建素材
            </Link>
          )}
          {showContent && (
            <Link
              href={`/collections/${collectionId}/settings`}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
              title="工作集设置"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>
          )}
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
