# Task Page Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform `/collections/[id]` from a simple card-entry dashboard into a four-zone, phase-driven task workbench.

**Architecture:** Add a `phase` column to the collections table. Refactor `CollectionNav` to a top status bar, restructure `CollectionLayout` to support left structure panel + center workspace + right context panel. Introduce phase-specific workspace components driven by `useState` in `page.tsx`.

**Tech Stack:** Next.js App Router, TypeScript, Drizzle ORM, SQLite/libSQL, Tailwind CSS, Vitest.

---

## File Structure

Create:
- `drizzle/0010_task_phase.sql` — migration: add `phase` column
- `src/components/collection/TaskTopBar.tsx` — phase status bar (replaces tab nav)
- `src/components/collection/StructurePanel.tsx` — left: skeleton tree for organize/create phases
- `src/components/collection/TaskContextPanel.tsx` — right: context info panel
- `src/components/collection/phases/CaptureWorkspace.tsx` — capture phase workspace
- `src/components/collection/phases/OrganizeWorkspace.tsx` — organize phase workspace
- `src/components/collection/phases/CreateWorkspace.tsx` — create phase stub
- `src/components/collection/phases/PublishWorkspace.tsx` — publish phase stub
- `src/components/collection/phases/IterateWorkspace.tsx` — iterate phase stub

Modify:
- `src/server/db/schema.ts` — add `phase` column to collections table
- `src/server/collection/repository.ts` — add `phase` to CollectionRecord, updateCollection
- `src/app/api/collections/[id]/route.ts` — accept `phase` in PATCH body
- `src/components/collection/CollectionNav.tsx` — remove tab nav, add phase status display
- `src/components/collection/CollectionLayout.tsx` — four-zone layout
- `src/app/collections/[id]/page.tsx` — phase state owner, composes four zones

---

### Task 1: Data Model — Add Phase Field

**Files:**
- Modify: `src/server/db/schema.ts`
- Create: `drizzle/0010_task_phase.sql`
- Modify: `src/server/collection/repository.ts`
- Modify: `src/app/api/collections/[id]/route.ts`

- [ ] **Step 1: Add `phase` column to schema**

In `src/server/db/schema.ts`, add the `phase` column to the `collections` table definition:

```ts
export const collections = sqliteTable("collections", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  areaId: text("area_id"),
  name: text("name").notNull(),
  topic: text("topic"),
  phase: text("phase").notNull().default("capture"),
  sortOrder: integer("sort_order").default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});
```

- [ ] **Step 2: Create migration SQL**

Create `drizzle/0010_task_phase.sql`:

```sql
ALTER TABLE collections ADD COLUMN phase TEXT NOT NULL DEFAULT 'capture';
```

- [ ] **Step 3: Update journal**

In `drizzle/meta/_journal.json`, add a new entry after index 9:

```json
{
  "idx": 10,
  "version": "6",
  "when": 1777922000000,
  "tag": "0010_task_phase",
  "breakpoints": true
}
```

- [ ] **Step 4: Run migration on local DB**

```bash
sqlite3 dev.db "ALTER TABLE collections ADD COLUMN phase TEXT NOT NULL DEFAULT 'capture';"
```

- [ ] **Step 5: Update CollectionRecord type and updateCollection in repository**

In `src/server/collection/repository.ts`, add `phase` to `CollectionRecord`:

```ts
export type CollectionRecord = {
  id: string;
  userId: string;
  areaId: string | null;
  name: string;
  topic: string | null;
  phase: string;
  sortOrder: number | null;
  createdAt: Date;
  updatedAt: Date;
};
```

Update `updateCollection` to accept `phase`:

```ts
export async function updateCollection(
  id: string,
  input: { name?: string; topic?: string | null; areaId?: string | null; phase?: string }
) {
  const db = await getDb();
  const now = new Date();
  const values: Record<string, unknown> = { updatedAt: now };
  if (input.name !== undefined) values.name = input.name;
  if (input.topic !== undefined) values.topic = input.topic;
  if (input.areaId !== undefined) values.areaId = input.areaId;
  if (input.phase !== undefined) values.phase = input.phase;
  await db
    .update(collections)
    .set(values)
    .where(eq(collections.id, id))
    .run();
}
```

- [ ] **Step 6: Update PATCH API route to accept phase**

In `src/app/api/collections/[id]/route.ts`, add `phase` to the zod schema:

```ts
const updateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  topic: z.string().nullable().optional(),
  areaId: z.string().nullable().optional(),
  phase: z.enum(["capture", "organize", "create", "publish", "iterate"]).optional()
});
```

- [ ] **Step 7: Verify with type check**

```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add src/server/db/schema.ts drizzle/0010_task_phase.sql drizzle/meta/_journal.json src/server/collection/repository.ts src/app/api/collections/[id]/route.ts
git commit -m "feat: add phase field to collections for task page state management"
```

---

### Task 2: Four-Zone Layout in CollectionLayout

**Files:**
- Modify: `src/components/collection/CollectionLayout.tsx`

- [ ] **Step 1: Restructure CollectionLayout for four zones**

Replace the current `CollectionLayout.tsx` content. The layout becomes: top bar + [sidebar | structure panel | main content | context panel].

```tsx
"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { CollectionNav } from "./CollectionNav";

type Area = { id: string; name: string; userId: string };
type Collection = { id: string; name: string; areaId: string | null; userId: string; phase?: string };

type Props = {
  children: React.ReactNode;
  phase?: string;
  structurePanel?: React.ReactNode;
  contextPanel?: React.ReactNode;
};

export function CollectionLayout({ children, phase, structurePanel, contextPanel }: Props) {
  const [userId] = useState("demo-user");
  const [area, setArea] = useState<Area | null>(null);
  const [collection, setCollection] = useState<Collection | null>(null);

  useEffect(() => {
    const savedId =
      localStorage.getItem("knowledgecast_collection_id") ??
      localStorage.getItem("knowledgecast_workspace_id");
    if (savedId) {
      fetch("/api/collections?userId=demo-user")
        .then((r) => r.json())
        .then((data) => {
          const list = (data.collections ?? []) as Collection[];
          const found = list.find((w) => w.id === savedId);
          if (found) setCollection(found);
        });
    }
  }, []);

  useEffect(() => {
    async function onCollectionChanged(event: Event) {
      const next = (event as CustomEvent<Collection>).detail;
      if (next?.id) {
        setCollection(next);
        if (next.areaId) {
          const response = await fetch(`/api/areas?userId=${encodeURIComponent(userId)}`);
          const data = await response.json();
          const areas = (data.areas ?? []) as Area[];
          setArea(areas.find((item) => item.id === next.areaId) ?? null);
        } else {
          setArea(null);
        }
      }
    }

    window.addEventListener("collection-changed", onCollectionChanged);
    return () => window.removeEventListener("collection-changed", onCollectionChanged);
  }, [userId]);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <CollectionNav
        collectionId={collection?.id}
        collectionName={collection?.name}
        areaName={area?.name}
        phase={phase}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          userId={userId}
          activeAreaId={area?.id ?? null}
          activeCollectionId={collection?.id ?? null}
          onAreaChange={setArea}
          onCollectionChange={setCollection}
        />
        {structurePanel && (
          <aside className="w-56 shrink-0 border-r border-gray-200 bg-white overflow-y-auto">
            {structurePanel}
          </aside>
        )}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
        {contextPanel && (
          <aside className="w-64 shrink-0 border-l border-gray-200 bg-white overflow-y-auto">
            {contextPanel}
          </aside>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update collections layout to pass props through**

In `src/app/collections/layout.tsx`, keep it minimal — the props come from page.tsx via children pattern. Actually, since the layout wraps children, and the phase/panels are page-level concerns, we need the page.tsx to render CollectionLayout directly instead of relying on the layout wrapper.

Change `src/app/collections/layout.tsx` to just export children directly (remove CollectionLayout wrapper):

```tsx
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

This lets each page under `/collections` compose its own layout. The main task page at `/collections/[id]/page.tsx` will use `CollectionLayout` directly.

- [ ] **Step 3: Verify type check**

```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/collection/CollectionLayout.tsx src/app/collections/layout.tsx
git commit -m "feat: restructure CollectionLayout to support four-zone task page layout"
```

---

### Task 3: Phase State Management in Page Entry

**Files:**
- Modify: `src/app/collections/[id]/page.tsx`

- [ ] **Step 1: Rewrite page.tsx as phase state owner**

Replace the current dashboard with the task workbench entry point:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CollectionLayout } from "@/components/collection/CollectionLayout";
import { CaptureWorkspace } from "@/components/collection/phases/CaptureWorkspace";
import { OrganizeWorkspace } from "@/components/collection/phases/OrganizeWorkspace";
import { CreateWorkspace } from "@/components/collection/phases/CreateWorkspace";
import { PublishWorkspace } from "@/components/collection/phases/PublishWorkspace";
import { IterateWorkspace } from "@/components/collection/phases/IterateWorkspace";

type Phase = "capture" | "organize" | "create" | "publish" | "iterate";

type Collection = { id: string; name: string; areaId: string | null; topic?: string | null; userId: string; phase?: string };

export default function TaskPage() {
  const { id } = useParams<{ id: string }>();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [phase, setPhase] = useState<Phase>("capture");
  const [loading, setLoading] = useState(true);

  const loadCollection = useCallback(() => {
    fetch("/api/collections?userId=demo-user")
      .then((r) => r.json())
      .then((data) => {
        const next = (data.collections as Collection[]).find((item) => item.id === id) ?? null;
        setCollection(next);
        if (next?.phase && ["capture", "organize", "create", "publish", "iterate"].includes(next.phase)) {
          setPhase(next.phase as Phase);
        }
        if (next) localStorage.setItem("knowledgecast_collection_id", next.id);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { loadCollection(); }, [loadCollection]);

  async function advancePhase(nextPhase: Phase) {
    setPhase(nextPhase);
    await fetch(`/api/collections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phase: nextPhase })
    });
  }

  function renderWorkspace() {
    if (!collection) return null;
    switch (phase) {
      case "capture":
        return <CaptureWorkspace collectionId={collection.id} onAdvance={(p) => advancePhase(p)} />;
      case "organize":
        return <OrganizeWorkspace collectionId={collection.id} onAdvance={(p) => advancePhase(p)} />;
      case "create":
        return <CreateWorkspace collectionId={collection.id} onAdvance={(p) => advancePhase(p)} />;
      case "publish":
        return <PublishWorkspace collectionId={collection.id} onAdvance={(p) => advancePhase(p)} />;
      case "iterate":
        return <IterateWorkspace collectionId={collection.id} onAdvance={(p) => advancePhase(p)} />;
    }
  }

  if (loading) {
    return (
      <CollectionLayout phase={phase}>
        <main className="px-8 py-8"><p className="text-sm text-gray-400">加载中...</p></main>
      </CollectionLayout>
    );
  }

  if (!collection) {
    return (
      <CollectionLayout phase={phase}>
        <main className="px-8 py-8"><p className="text-sm text-gray-400">工作集未找到</p></main>
      </CollectionLayout>
    );
  }

  return (
    <CollectionLayout phase={phase}>
      {renderWorkspace()}
    </CollectionLayout>
  );
}
```

- [ ] **Step 2: Verify type check passes**

```bash
npx tsc --noEmit
```
Expected: Errors about missing phase workspace components (created next).

- [ ] **Step 3: Commit**

```bash
git add src/app/collections/[id]/page.tsx
git commit -m "feat: add phase state management to task page entry"
```

---

### Task 4: Task Top Bar — Replace Tab Nav with Phase Status

**Files:**
- Modify: `src/components/collection/CollectionNav.tsx`

- [ ] **Step 1: Add phase prop and replace tabs with phase status**

Modify `CollectionNav.tsx`:
- Add `phase` prop to Props
- Remove the `tabs` array and the tab nav section
- Add a phase status indicator + next action button between breadcrumbs and right-side actions
- Keep logo, breadcrumbs, "+ 新建素材" button, UserMenu
- Move settings link to a gear icon near UserMenu

```tsx
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

type Props = {
  collectionId?: string;
  collectionName?: string;
  areaName?: string;
  phase?: string;
};

export function CollectionNav({ collectionId, collectionName, areaName, phase }: Props) {
  const pathname = usePathname();
  const isUnassigned = pathname === "/unassigned";
  const showContent = !isUnassigned && collectionId && collectionName;
  const phaseInfo = phase ? phaseLabels[phase] : null;

  return (
    <header className="shrink-0 border-b border-gray-200 bg-white">
      <div className="flex items-center px-6 py-2.5 gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <Logo />
          <span className="text-base font-bold tracking-tight text-gray-900">KnowledgeCast</span>
        </Link>

        {(showContent || isUnassigned) && <div className="h-5 w-px bg-gray-200 shrink-0" />}

        {/* 未归类素材 */}
        {isUnassigned && (
          <div className="flex items-center gap-1.5 text-sm shrink-0">
            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            <span className="font-medium text-gray-600">未归类素材</span>
          </div>
        )}

        {/* 面包屑 + 阶段标签 */}
        {showContent && (
          <div className="flex items-center gap-3 text-sm shrink-0">
            {areaName && (
              <>
                <span className="text-gray-400">{areaName}</span>
                <span className="text-gray-300">/</span>
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

        {/* 右侧操作 */}
        <div className="flex items-center gap-2 ml-auto shrink-0">
          {showContent && (
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
```

- [ ] **Step 2: Verify type check**

```bash
npx tsc --noEmit
```
Expected: Only errors from missing phase workspace files.

- [ ] **Step 3: Commit**

```bash
git add src/components/collection/CollectionNav.tsx
git commit -m "feat: replace tab nav with phase status bar in CollectionNav"
```

---

### Task 5: Phase Workspace Stubs + CaptureWorkspace

**Files:**
- Create: `src/components/collection/phases/CaptureWorkspace.tsx`
- Create: `src/components/collection/phases/OrganizeWorkspace.tsx`
- Create: `src/components/collection/phases/CreateWorkspace.tsx`
- Create: `src/components/collection/phases/PublishWorkspace.tsx`
- Create: `src/components/collection/phases/IterateWorkspace.tsx`

- [ ] **Step 1: Create phase workspace interface**

Create the directory and all five workspace components. Capture gets the real implementation; others start as stubs.

`src/components/collection/phases/CaptureWorkspace.tsx` — real implementation, reuses existing CaptureInput and FragmentList:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { CaptureInput } from "@/components/collection/CaptureInput";
import { FragmentList } from "@/components/collection/FragmentList";

type Collection = { id: string; name: string; areaId: string | null; userId: string };
type Props = {
  collectionId: string;
  onAdvance: (phase: "organize") => void;
};

export function CaptureWorkspace({ collectionId, onAdvance }: Props) {
  const [userId] = useState("demo-user");
  const [refreshKey, setRefreshKey] = useState(0);
  const [fragmentCount, setFragmentCount] = useState(0);

  const loadCount = useCallback(() => {
    fetch(`/api/knowledge-items?userId=demo-user&collectionId=${encodeURIComponent(collectionId)}&limit=200`)
      .then((r) => r.json())
      .then((data) => {
        const active = (data.knowledgeItems ?? []).filter((i: { status: string }) => i.status !== "archived");
        setFragmentCount(active.length);
      });
  }, [collectionId]);

  useEffect(() => { loadCount(); }, [loadCount]);

  function handleCaptureDone() {
    setRefreshKey((k) => k + 1);
    loadCount();
  }

  return (
    <main className="px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">采集素材</h1>
          <p className="text-sm text-gray-500 mt-1">粘贴碎片知识、链接或 Markdown，系统自动识别类型并存入当前工作集</p>
        </div>
        {fragmentCount >= 3 && (
          <button
            onClick={() => onAdvance("organize")}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 transition"
          >
            开始整理 →
          </button>
        )}
      </div>
      {fragmentCount < 3 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700">
          建议至少添加 3 条素材后再开始整理，当前有 {fragmentCount} 条
        </div>
      )}
      <CaptureInput userId={userId} collectionId={collectionId} onDone={handleCaptureDone} />
      <FragmentList key={refreshKey} userId={userId} collectionId={collectionId} />
    </main>
  );
}
```

- [ ] **Step 2: Create stub workspaces**

`src/components/collection/phases/OrganizeWorkspace.tsx`:

```tsx
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
```

`src/components/collection/phases/CreateWorkspace.tsx`:

```tsx
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
```

`src/components/collection/phases/PublishWorkspace.tsx`:

```tsx
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
```

`src/components/collection/phases/IterateWorkspace.tsx`:

```tsx
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
```

- [ ] **Step 3: Verify type check passes**

```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/collection/phases/
git commit -m "feat: add phase workspace components with CaptureWorkspace implementation"
```

---

### Task 6: StructurePanel and TaskContextPanel

**Files:**
- Create: `src/components/collection/StructurePanel.tsx`
- Create: `src/components/collection/TaskContextPanel.tsx`

- [ ] **Step 1: Create StructurePanel**

`src/components/collection/StructurePanel.tsx`:

```tsx
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
```

- [ ] **Step 2: Create TaskContextPanel**

`src/components/collection/TaskContextPanel.tsx`:

```tsx
"use client";

type Props = {
  phase: string;
};

export function TaskContextPanel({ phase }: Props) {
  const hints: Record<string, { title: string; items: string[] }> = {
    capture: {
      title: "采集提示",
      items: [
        "支持粘贴文本、链接和 Markdown",
        "素材越多，AI 生成的骨架越完整",
        "建议至少 3 条素材后开始整理"
      ]
    },
    organize: {
      title: "整理提示",
      items: [
        "选择一个培训框架作为骨架模板",
        "AI 会根据选中素材生成内容骨架",
        "骨架确认后进入分段创作"
      ]
    },
    create: {
      title: "创作提示",
      items: [
        "点击左侧骨架节点选择创作目标",
        "AI 基于策划卡生成段落内容",
        "逐段完成，不必一次全部生成"
      ]
    },
    publish: {
      title: "发布提示",
      items: [
        "检查内容是否可讲、可信、可用",
        "生成分享链接供团队预览",
        "可随时回到创作阶段继续完善"
      ]
    },
    iterate: {
      title: "迭代提示",
      items: [
        "添加新材料后重新整理骨架",
        "基于反馈回到采集或创作阶段",
        "每次迭代产生新版本"
      ]
    }
  };

  const info = hints[phase] ?? hints.capture;

  return (
    <div className="px-4 py-4">
      <h3 className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-3">{info.title}</h3>
      <ul className="space-y-2">
        {info.items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-gray-500">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Wire panels into page.tsx**

Update `src/app/collections/[id]/page.tsx` to import and pass the panels:

Add imports:
```tsx
import { StructurePanel } from "@/components/collection/StructurePanel";
import { TaskContextPanel } from "@/components/collection/TaskContextPanel";
```

Update the return statement to pass `structurePanel` and `contextPanel`:

```tsx
return (
  <CollectionLayout
    phase={phase}
    structurePanel={<StructurePanel phase={phase} />}
    contextPanel={<TaskContextPanel phase={phase} />}
  >
    {renderWorkspace()}
  </CollectionLayout>
);
```

- [ ] **Step 4: Verify type check**

```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/collection/StructurePanel.tsx src/components/collection/TaskContextPanel.tsx src/app/collections/[id]/page.tsx
git commit -m "feat: add StructurePanel and TaskContextPanel for task page side panels"
```

---

### Task 7: Redirect Legacy Sub-Pages

**Files:**
- Modify: `src/app/collections/[id]/capture/page.tsx`
- Modify: `src/app/collections/[id]/structure/page.tsx`
- Modify: `src/app/collections/[id]/publish/page.tsx`

- [ ] **Step 1: Add redirects from old sub-pages to task page**

Replace the content of each sub-page with a redirect. This keeps the routes alive but sends users to the unified task page.

`src/app/collections/[id]/capture/page.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function CaptureRedirect() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  useEffect(() => { router.replace(`/collections/${id}`); }, [id, router]);
  return <main className="px-8 py-8"><p className="text-sm text-gray-400">跳转中...</p></main>;
}
```

`src/app/collections/[id]/structure/page.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function StructureRedirect() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  useEffect(() => { router.replace(`/collections/${id}`); }, [id, router]);
  return <main className="px-8 py-8"><p className="text-sm text-gray-400">跳转中...</p></main>;
}
```

`src/app/collections/[id]/publish/page.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function PublishRedirect() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  useEffect(() => { router.replace(`/collections/${id}`); }, [id, router]);
  return <main className="px-8 py-8"><p className="text-sm text-gray-400">跳转中...</p></main>;
}
```

- [ ] **Step 2: Verify type check**

```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/collections/[id]/capture/page.tsx src/app/collections/[id]/structure/page.tsx src/app/collections/[id]/publish/page.tsx
git commit -m "feat: redirect legacy sub-pages to unified task page"
```

---

### Task 8: Final Verification

- [ ] **Step 1: Run full type check**

```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 2: Run production build**

```bash
npm run build 2>&1 | tail -20
```
Expected: Successful build.

- [ ] **Step 3: Run existing tests**

```bash
npx vitest run 2>&1 | tail -20
```
Expected: All existing tests pass.

- [ ] **Step 4: Manual verification checklist**

Start dev server and verify:
- [ ] Navigate to `/collections/[id]` — shows four-zone layout
- [ ] Top bar shows breadcrumbs + phase badge instead of tabs
- [ ] Phase badge reads "● 采集" by default
- [ ] "+ 新建素材" button still works
- [ ] Settings gear icon navigates to `/collections/[id]/settings`
- [ ] Left Sidebar still shows areas/collections tree
- [ ] Capture workspace shows CaptureInput + FragmentList
- [ ] "开始整理 →" button appears when 3+ fragments exist
- [ ] Clicking "开始整理 →" switches to organize phase
- [ ] Phase badge updates to "● 整理"
- [ ] Right context panel shows phase-appropriate hints
- [ ] `/collections/[id]/capture` redirects to `/collections/[id]`
- [ ] `/collections/[id]/structure` redirects to `/collections/[id]`

- [ ] **Step 5: Commit any verification fixes**

If any issues found, fix and commit.
