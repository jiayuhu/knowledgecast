"use client";

import Link from "next/link";

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

export function WorkspaceNav() {
  return (
    <header className="shrink-0 border-b border-gray-200 bg-white">
      <div className="flex items-center px-6 py-3">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <Logo />
          <span className="text-base font-bold tracking-tight text-gray-900">
            KnowledgeCast
          </span>
        </Link>
      </div>
    </header>
  );
}
