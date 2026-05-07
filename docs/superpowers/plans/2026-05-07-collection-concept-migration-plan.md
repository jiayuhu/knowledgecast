# Collection Concept Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the current workspace-level data concept to collection across schema, server APIs, frontend routes, UI state, tests, and docs.

**Architecture:** Keep `areas` as the top-level “工作区” grouping and make `collections` the “工作集” entity. Migrate database names and TypeScript contracts to `collection`, move editor routes to `/collections/[id]`, and remove old `/workspace/*` routes and links without redirect compatibility.

**Tech Stack:** Next.js App Router, TypeScript, Drizzle ORM, SQLite/libSQL, Vitest, ESLint.

---

## File Structure

Create:

- `src/server/collection/repository.ts` — collection CRUD and reorder behavior, replacing workspace repository.
- `src/app/api/collections/route.ts` — collection list/create/reorder API.
- `src/app/api/collections/[id]/route.ts` — collection update/delete API.
- `src/app/collections/layout.tsx` — editor shell layout for collection pages.
- `src/app/collections/[id]/page.tsx` — collection dashboard.
- `src/app/collections/[id]/capture/page.tsx` — collection capture page.
- `src/app/collections/[id]/structure/page.tsx` — collection structure page.
- `src/app/collections/[id]/publish/page.tsx` — collection publish page.
- `src/app/collections/[id]/settings/page.tsx` — collection settings page.
- `src/app/unassigned/page.tsx` — unassigned materials page.
- `src/components/workspace/CollectionLayout.tsx` — renamed layout component; kept in existing folder to limit import churn.
- `src/components/workspace/CollectionNav.tsx` — renamed nav component; kept in existing folder to limit import churn.
- `tests/server/collection.test.ts` — collection repository coverage.
- `drizzle/0008_collections_migration.sql` — table and column rename migration.

Modify:

- `src/server/db/schema.ts` — `workspaces` -> `collections`, `workspaceId` -> `collectionId`.
- `src/server/knowledge/repository.ts` — knowledge item ownership field rename.
- `src/server/ingest/storage.ts` — ingest input field rename.
- `src/app/api/knowledge-items/route.ts` — use `collectionId` query/body.
- `src/app/api/knowledge-items/[id]/route.ts` — PATCH uses `collectionId`.
- `src/app/page.tsx` — redirect to first collection.
- `src/components/workspace/Sidebar.tsx` — collection state, `/api/collections`, `/collections/[id]`, `/unassigned`.
- `src/components/workspace/CaptureInput.tsx` — `collectionId` prop and API body.
- `src/components/workspace/FragmentList.tsx` — `collectionId` query.
- Existing server tests — update imports and expected property names.
- `README.md`, `docs/prd.md`, `docs/api.md`, `docs/superpowers/specs/2026-04-25-knowledgecast-design.md`, `AGENTS.md` — documentation sync.

Delete after replacements compile:

- `src/server/workspace/repository.ts`
- `src/app/api/workspaces/route.ts`
- `src/app/api/workspaces/[id]/route.ts`
- `src/app/workspace/*`
- `src/components/workspace/WorkspaceLayout.tsx`
- `src/components/workspace/WorkspaceNav.tsx`

---

## Task 1: Server Data Model and Repository

**Files:**
- Create: `tests/server/collection.test.ts`
- Create: `src/server/collection/repository.ts`
- Create: `drizzle/0008_collections_migration.sql`
- Modify: `src/server/db/schema.ts`
- Modify: `src/server/knowledge/repository.ts`
- Delete: `src/server/workspace/repository.ts`

- [ ] **Step 1: Write failing collection repository tests**

Create `tests/server/collection.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import {
  createCollection,
  deleteCollection,
  listCollections,
  updateCollection
} from "@/server/collection/repository";
import { createKnowledgeItem, listOrphanedKnowledgeItems } from "@/server/knowledge/repository";
import { getDb } from "@/server/db/client";
import { collections, knowledgeItems } from "@/server/db/schema";

describe("collection repository", () => {
  beforeEach(async () => {
    const db = await getDb();
    await db.delete(knowledgeItems).run();
    await db.delete(collections).run();
  });

  it("creates and lists collections by area in sort order", async () => {
    const first = await createCollection("user_1", "First", "area_1");
    const second = await createCollection("user_1", "Second", "area_1");
    await createCollection("user_1", "Other", "area_2");

    const result = await listCollections("user_1", "area_1");

    expect(result.map((item) => item.id)).toEqual([first.id, second.id]);
    expect(result.map((item) => item.name)).toEqual(["First", "Second"]);
  });

  it("updates collection name, topic, and area", async () => {
    const created = await createCollection("user_1", "Draft", "area_1");

    await updateCollection(created.id, {
      name: "Published",
      topic: "Onboarding",
      areaId: "area_2"
    });

    const [updated] = await listCollections("user_1", "area_2");
    expect(updated.name).toBe("Published");
    expect(updated.topic).toBe("Onboarding");
  });

  it("deleting a collection leaves materials unassigned", async () => {
    const created = await createCollection("user_1", "Draft", "area_1");
    await createKnowledgeItem({
      userId: "user_1",
      collectionId: created.id,
      sourceType: "text",
      title: "Note",
      content: "Body"
    });

    await deleteCollection(created.id);

    const orphaned = await listOrphanedKnowledgeItems("user_1");
    expect(orphaned).toHaveLength(1);
    expect(orphaned[0]?.collectionId).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run tests/server/collection.test.ts
```

Expected: FAIL because `@/server/collection/repository` and `collections` exports do not exist.

- [ ] **Step 3: Update schema exports**

In `src/server/db/schema.ts`, replace the workspace table and knowledge item field with:

```ts
export const collections = sqliteTable("collections", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  areaId: text("area_id"),
  name: text("name").notNull(),
  topic: text("topic"),
  sortOrder: integer("sort_order").default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});

export const knowledgeItems = sqliteTable("knowledge_items", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  collectionId: text("collection_id"),
  sourceType: text("source_type").notNull(),
  title: text("title"),
  content: text("content").notNull(),
  originalUrl: text("original_url"),
  status: text("status").notNull().default("draft"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});
```

- [ ] **Step 4: Add migration SQL**

Create `drizzle/0008_collections_migration.sql`:

```sql
ALTER TABLE `workspaces` RENAME TO `collections`;--> statement-breakpoint
ALTER TABLE `knowledge_items` RENAME COLUMN `workspace_id` TO `collection_id`;
```

After implementation, run `npm run db:generate` only if Drizzle metadata must be refreshed. If it generates a different migration, keep one authoritative migration and remove the duplicate before commit.

- [ ] **Step 5: Implement collection repository**

Create `src/server/collection/repository.ts`:

```ts
import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { collections, knowledgeItems } from "../db/schema";

export type CollectionRecord = {
  id: string;
  userId: string;
  areaId: string | null;
  name: string;
  topic: string | null;
  sortOrder: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function createCollection(userId: string, name: string, areaId?: string) {
  const now = new Date();
  const db = await getDb();
  const existing = await listCollections(userId, areaId);
  const maxOrder = existing.reduce((max, item) => Math.max(max, item.sortOrder ?? 0), -1);

  const record: CollectionRecord = {
    id: randomUUID(),
    userId,
    areaId: areaId ?? null,
    name,
    topic: null,
    sortOrder: maxOrder + 1,
    createdAt: now,
    updatedAt: now
  };

  await db.insert(collections).values(record).run();
  return record;
}

export async function listCollections(userId: string, areaId?: string | null) {
  const db = await getDb();
  const conditions = [eq(collections.userId, userId)];
  if (areaId) conditions.push(eq(collections.areaId, areaId));

  return db
    .select()
    .from(collections)
    .where(and(...conditions))
    .orderBy(asc(collections.sortOrder), asc(collections.createdAt))
    .all();
}

export async function getCollection(id: string) {
  const db = await getDb();
  const rows = await db.select().from(collections).where(eq(collections.id, id)).all();
  return rows[0] ?? null;
}

export async function updateCollection(
  id: string,
  input: { name?: string; topic?: string | null; areaId?: string | null }
) {
  const db = await getDb();
  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) values.name = input.name;
  if (input.topic !== undefined) values.topic = input.topic;
  if (input.areaId !== undefined) values.area_id = input.areaId;

  await db.update(collections).set(values).where(eq(collections.id, id)).run();
}

export async function reorderCollections(orderedIds: string[]) {
  const db = await getDb();
  for (let i = 0; i < orderedIds.length; i++) {
    await db.update(collections).set({ sortOrder: i }).where(eq(collections.id, orderedIds[i])).run();
  }
}

export async function deleteCollection(id: string) {
  const db = await getDb();
  await db
    .update(knowledgeItems)
    .set({ collectionId: null })
    .where(eq(knowledgeItems.collectionId, id))
    .run();
  await db.delete(collections).where(eq(collections.id, id)).run();
}

export async function ensureDefaultCollection(userId: string, areaId?: string) {
  const existing = await listCollections(userId, areaId);
  if (existing.length === 0) {
    return createCollection(userId, "默认工作集", areaId);
  }
  return existing[0];
}
```

- [ ] **Step 6: Rename knowledge repository field contract**

In `src/server/knowledge/repository.ts`, change `workspaceId` to `collectionId` in the exported type, function inputs, returned objects, and filters. The core patterns must be:

```ts
export type KnowledgeItemRecord = {
  id: string;
  userId: string;
  collectionId: string | null;
  sourceType: string;
  title: string | null;
  content: string;
  originalUrl: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};
```

```ts
if (input.collectionId !== undefined) values.collection_id = input.collectionId;
```

```ts
if (collectionId) {
  conditions.push(eq(knowledgeItems.collectionId, collectionId));
}
```

```ts
.where(and(eq(knowledgeItems.userId, userId), isNull(knowledgeItems.collectionId)))
```

- [ ] **Step 7: Remove workspace repository**

Delete `src/server/workspace/repository.ts` after all imports have moved to `@/server/collection/repository`.

- [ ] **Step 8: Run focused tests**

Run:

```bash
npx vitest run tests/server/collection.test.ts tests/server/repository.test.ts
```

Expected: PASS after updating affected tests to use `collectionId`.

- [ ] **Step 9: Commit**

```bash
git add src/server/db/schema.ts src/server/collection/repository.ts src/server/knowledge/repository.ts tests/server/collection.test.ts tests/server/repository.test.ts drizzle/0008_collections_migration.sql
git add -u src/server/workspace/repository.ts
git commit -m "refactor: rename workspace data model to collections"
```

---

## Task 2: Collection APIs and Knowledge Item Contract

**Files:**
- Create: `src/app/api/collections/route.ts`
- Create: `src/app/api/collections/[id]/route.ts`
- Modify: `src/app/api/knowledge-items/route.ts`
- Modify: `src/app/api/knowledge-items/[id]/route.ts`
- Modify: `src/server/ingest/storage.ts`
- Modify: `tests/server/ingest.test.ts`
- Delete: `src/app/api/workspaces/route.ts`
- Delete: `src/app/api/workspaces/[id]/route.ts`

- [ ] **Step 1: Write failing API contract checks in server tests**

Update `tests/server/ingest.test.ts` by adding `collectionId` to one stored input:

```ts
const item = await storeKnowledgeInput({
  userId: "test_user",
  collectionId: "collection_1",
  sourceType: "url",
  content: "https://example.com/article",
  enrich: false
});

expect(item.collectionId).toBe("collection_1");
```

Run:

```bash
npx vitest run tests/server/ingest.test.ts
```

Expected: FAIL until ingest storage accepts `collectionId`.

- [ ] **Step 2: Implement collection API routes**

Create `src/app/api/collections/route.ts` using the current workspaces route behavior with renamed imports and response fields:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureDefaultArea } from "@/server/area/repository";
import {
  createCollection,
  listCollections,
  reorderCollections
} from "@/server/collection/repository";

const createCollectionSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1),
  areaId: z.string().optional()
});

const reorderSchema = z.object({
  orderedIds: z.array(z.string())
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") ?? "demo-user";
  const areaId = searchParams.get("areaId");
  let collections = await listCollections(userId, areaId);

  if (collections.length === 0) {
    const area = await ensureDefaultArea(userId);
    const defaultCollection = await createCollection(userId, "默认工作集", area.id);
    collections = [defaultCollection];
  }

  return NextResponse.json({ collections });
}

export async function PUT(request: Request) {
  const payload = reorderSchema.parse(await request.json());
  await reorderCollections(payload.orderedIds);
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const payload = createCollectionSchema.parse(await request.json());
  const collection = await createCollection(payload.userId, payload.name, payload.areaId);
  return NextResponse.json({ collection });
}
```

Create `src/app/api/collections/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { updateCollection, deleteCollection } from "@/server/collection/repository";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  topic: z.string().nullable().optional(),
  areaId: z.string().nullable().optional()
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const payload = updateSchema.parse(await request.json());
  await updateCollection(id, payload);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deleteCollection(id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Update knowledge item API**

In `src/app/api/knowledge-items/route.ts`, replace schema and usage:

```ts
const createSchema = z.object({
  userId: z.string().default("demo-user"),
  collectionId: z.string().optional(),
  sourceType: z.enum(["text", "url", "markdown"]).optional(),
  content: z.string().min(1),
  title: z.string().optional(),
  enrich: z.boolean().optional()
});
```

Use:

```ts
const collectionId = url.searchParams.get("collectionId") ?? undefined;
```

and pass `collectionId` to repository/ingest functions.

In `src/app/api/knowledge-items/[id]/route.ts`, replace PATCH schema field:

```ts
collectionId: z.string().nullable().optional()
```

and call:

```ts
collectionId: payload.collectionId
```

- [ ] **Step 4: Update ingest storage contract**

In `src/server/ingest/storage.ts`, replace `workspaceId` with `collectionId` in input types and calls to `createKnowledgeItem`.

The call site must include:

```ts
collectionId: input.collectionId
```

- [ ] **Step 5: Delete old workspace API routes**

Delete:

```text
src/app/api/workspaces/route.ts
src/app/api/workspaces/[id]/route.ts
```

No compatibility route is kept for `/api/workspaces`; all API callers must use `/api/collections`.

- [ ] **Step 6: Run focused API-adjacent tests**

Run:

```bash
npx vitest run tests/server/ingest.test.ts tests/server/repository.test.ts tests/server/collection.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/collections src/app/api/knowledge-items src/server/ingest/storage.ts tests/server/ingest.test.ts
git add -u src/app/api/workspaces
git commit -m "refactor: expose collection APIs"
```

---

## Task 3: Frontend Routes, Sidebar, and Component State

**Files:**
- Create: `src/app/collections/layout.tsx`
- Create: `src/app/collections/[id]/page.tsx`
- Create: `src/app/collections/[id]/capture/page.tsx`
- Create: `src/app/collections/[id]/structure/page.tsx`
- Create: `src/app/collections/[id]/publish/page.tsx`
- Create: `src/app/collections/[id]/settings/page.tsx`
- Create: `src/app/unassigned/page.tsx`
- Create: `src/components/workspace/CollectionLayout.tsx`
- Create: `src/components/workspace/CollectionNav.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/components/workspace/Sidebar.tsx`
- Modify: `src/components/workspace/CaptureInput.tsx`
- Modify: `src/components/workspace/FragmentList.tsx`
- Delete: `src/app/workspace/*`
- Delete: `src/components/workspace/WorkspaceLayout.tsx`
- Delete: `src/components/workspace/WorkspaceNav.tsx`

- [ ] **Step 1: Move route files**

Use `git mv` for history preservation:

```bash
mkdir -p src/app/collections/[id]
git mv src/app/workspace/[id]/page.tsx src/app/collections/[id]/page.tsx
git mv src/app/workspace/[id]/capture/page.tsx src/app/collections/[id]/capture/page.tsx
git mv src/app/workspace/[id]/structure/page.tsx src/app/collections/[id]/structure/page.tsx
git mv src/app/workspace/[id]/publish/page.tsx src/app/collections/[id]/publish/page.tsx
git mv src/app/workspace/[id]/settings/page.tsx src/app/collections/[id]/settings/page.tsx
git mv src/app/workspace/layout.tsx src/app/collections/layout.tsx
git mv src/app/workspace/orphaned/page.tsx src/app/unassigned/page.tsx
git mv src/components/workspace/WorkspaceLayout.tsx src/components/workspace/CollectionLayout.tsx
git mv src/components/workspace/WorkspaceNav.tsx src/components/workspace/CollectionNav.tsx
```

Delete the obsolete helper pages under `src/app/workspace/capture`, `src/app/workspace/structure`, `src/app/workspace/share`, and `src/app/workspace/settings`. No `/workspace/*` route files should remain.

- [ ] **Step 2: Update collection layout imports**

In `src/app/collections/layout.tsx`:

```tsx
import { CollectionLayout } from "@/components/workspace/CollectionLayout";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <CollectionLayout>{children}</CollectionLayout>;
}
```

In `src/components/workspace/CollectionLayout.tsx`, rename the internal type and state:

```ts
type Collection = { id: string; name: string; areaId: string | null; userId: string };
```

Use localStorage migration:

```ts
const savedId =
  localStorage.getItem("knowledgecast_collection_id") ??
  localStorage.getItem("knowledgecast_workspace_id");
```

Fetch:

```ts
fetch("/api/collections?userId=demo-user")
```

Read:

```ts
const list = (data.collections ?? []) as Collection[];
```

Render `CollectionNav` with `collectionId`, `collectionName`, and `onCollectionChange`.

- [ ] **Step 3: Update CollectionNav links**

In `src/components/workspace/CollectionNav.tsx`, tabs must be:

```ts
const tabs = [
  { label: "采集", href: (id: string) => `/collections/${id}/capture` },
  { label: "整理", href: (id: string) => `/collections/${id}/structure` },
  { label: "发布", href: (id: string) => `/collections/${id}/publish` },
  { label: "设置", href: (id: string) => `/collections/${id}/settings` }
];
```

Use:

```ts
const isUnassigned = pathname === "/unassigned";
const showTabs = !isUnassigned && collectionId && collectionName;
```

The breadcrumb link is:

```tsx
<Link href={`/collections/${collectionId}`}>{collectionName}</Link>
```

The primary action link is:

```tsx
<Link href={`/collections/${collectionId}/capture`}>+ 新建素材</Link>
```

- [ ] **Step 4: Update Sidebar collection behavior**

In `src/components/workspace/Sidebar.tsx`, rename type and props to collection:

```ts
type Collection = { id: string; name: string; areaId: string | null; userId: string };
```

Use:

```ts
localStorage.setItem("knowledgecast_collection_id", collection.id);
window.dispatchEvent(new CustomEvent("collection-changed", { detail: collection }));
```

Fetch collection lists from:

```ts
`/api/collections?userId=${encodeURIComponent(userId)}&areaId=${encodeURIComponent(area.id)}`
```

Create via:

```ts
fetch("/api/collections", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ userId, areaId, name: newName.trim() })
});
```

Navigate via:

```ts
router.push(`/collections/${collection.id}`);
```

Point unassigned link to:

```tsx
<Link href="/unassigned">未归类素材</Link>
```

- [ ] **Step 5: Update page-level route code**

In every moved `src/app/collections/[id]/**/page.tsx` file:

Replace:

```ts
fetch("/api/workspaces?userId=demo-user")
```

with:

```ts
fetch("/api/collections?userId=demo-user")
```

Replace:

```ts
data.workspaces as Workspace[]
```

with:

```ts
data.collections as Collection[]
```

Replace links beginning with `/workspace/${id}` with `/collections/${id}`.

Replace knowledge item queries:

```ts
workspaceId=${encodeURIComponent(id)}
```

with:

```ts
collectionId=${encodeURIComponent(id)}
```

- [ ] **Step 6: Update CaptureInput and FragmentList props**

In `src/components/workspace/CaptureInput.tsx`:

```ts
type Props = {
  userId: string;
  collectionId: string;
  onDone?: () => void;
};
```

Send:

```ts
body: JSON.stringify({
  userId,
  collectionId,
  sourceType,
  content,
  title,
  enrich
})
```

In `src/components/workspace/FragmentList.tsx`, query:

```ts
`/api/knowledge-items?userId=${encodeURIComponent(userId)}&collectionId=${encodeURIComponent(collectionId)}&limit=50`
```

- [ ] **Step 7: Update app root redirect**

In `src/app/page.tsx`, use:

```ts
import { listCollections } from "@/server/collection/repository";
import { redirect } from "next/navigation";

export default async function Home() {
  const collections = await listCollections("demo-user");
  if (collections.length > 0) {
    redirect(`/collections/${collections[0].id}`);
  }
  redirect("/collections/capture");
}
```

If `/collections/capture` is not retained as a helper route, redirect to `/unassigned` instead.

- [ ] **Step 8: Remove old workspace route files**

Delete remaining files under `src/app/workspace`. Do not add redirect routes or rewrite rules for `/workspace/*`.

- [ ] **Step 9: Run type check**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS with no references to deleted route modules or workspace repository imports.

- [ ] **Step 10: Commit**

```bash
git add src/app src/components/workspace
git add -u src/app/workspace src/components/workspace
git commit -m "refactor: move editor routes to collections"
```

---

## Task 4: Documentation and Current-Link Cleanup

**Files:**
- Modify: `README.md`
- Modify: `docs/prd.md`
- Modify: `docs/api.md`
- Modify: `docs/superpowers/specs/2026-04-25-knowledgecast-design.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Confirm no old route compatibility is configured**

Inspect `next.config.ts` and do not add `redirects()` for `/workspace/*`. If a previous implementation attempt added such redirects, remove them.

Run:

```bash
rg "/workspace" next.config.ts
```

Expected: no output.

- [ ] **Step 2: Update docs/api.md**

Replace `/api/workspaces` section with `/api/collections` and update type names:

```ts
type Collection = {
  id: string;
  userId: string;
  areaId: string | null;
  name: string;
  topic: string | null;
  sortOrder: number | null;
  createdAt: string;
  updatedAt: string;
};
```

For knowledge items, replace `workspaceId` with:

```ts
collectionId: string | null;
```

Document:

```text
GET /api/knowledge-items?userId=demo-user&collectionId=...
```

- [ ] **Step 3: Update design spec**

In `docs/superpowers/specs/2026-04-25-knowledgecast-design.md`, replace route references:

```text
/workspace/[id] -> /collections/[id]
/workspace/[id]/capture -> /collections/[id]/capture
/workspace/[id]/structure -> /collections/[id]/structure
/workspace/[id]/publish -> /collections/[id]/publish
/workspace/orphaned -> /unassigned
```

Do not document `/workspace/*` as a supported legacy route.

Update data model sentence to:

```text
- `Collection`：工作集（名称、培训主题 topic、排序序号、所属 area_id），素材和培训页的归属容器
```

Update delete behavior sentence to:

```text
删除工作集时，关联素材的 `collectionId` 被置空而非删除。这些脱离工作集的素材进入「未归类素材」视图。
```

- [ ] **Step 4: Update PRD, README, and AGENTS**

In `README.md`, update project tree entries:

```text
src/app/collections/[id]/            # 工作集路由
src/server/collection/repository.ts  # 工作集 CRUD
```

In `docs/prd.md`, use “工作集 Collection” when describing the entity that holds materials.

In `AGENTS.md`, add one naming rule under Working Rules:

```text
- “工作区”对应 area；“工作集”对应 collection。数据库、API、URL 和 TypeScript 业务命名统一使用 collection，不再使用 workspace 表示工作集。
```

- [ ] **Step 5: Search for stale current-code references**

Run:

```bash
rg "workspaceId|workspace_id|/api/workspaces|/workspace/|from \"@/server/workspace|workspaces" src tests README.md docs/api.md docs/prd.md docs/superpowers/specs/2026-04-25-knowledgecast-design.md AGENTS.md
```

Expected: no output from current code or current docs. Historical plans/specs outside the checked current docs may still mention the old names, but `src`, `tests`, `README.md`, `docs/api.md`, `docs/prd.md`, current design spec, and `AGENTS.md` must not use current-link `/workspace/*`, `workspaceId`, `workspace_id`, `/api/workspaces`, or `@/server/workspace`.

- [ ] **Step 6: Commit**

```bash
git add README.md docs/prd.md docs/api.md docs/superpowers/specs/2026-04-25-knowledgecast-design.md AGENTS.md
git commit -m "docs: document collection routing and API"
```

---

## Task 5: Final Verification

**Files:**
- Modify only if verification exposes a defect.

- [ ] **Step 1: Run full server test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 2: Run TypeScript check**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 4: Run production build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Final stale-name scan**

Run:

```bash
rg "workspaceId|workspace_id|/api/workspaces|from \"@/server/workspace" src tests docs/api.md README.md AGENTS.md
```

Expected: no output.

Run:

```bash
rg "/workspace" src next.config.ts docs/api.md README.md AGENTS.md
```

Expected: no output.

- [ ] **Step 6: Commit verification fixes if needed**

If fixes were required:

```bash
git add <changed-files>
git commit -m "fix: complete collection migration verification"
```

If no fixes were required, do not create an empty commit.

---

## Self-Review

Spec coverage:

- Data table and field rename: Task 1.
- API rename and `collectionId`: Task 2.
- Frontend route migration to `/collections/[id]`: Task 3.
- `/unassigned` route and removal of old URL links/routes: Tasks 3 and 4.
- Component/localStorage state rename: Task 3.
- Documentation updates: Task 4.
- Verification: Task 5.

Placeholder scan:

- No unresolved placeholders are intentionally left in this plan.
- Every code step names exact files and commands.

Type consistency:

- Server entity type is `CollectionRecord`.
- Public API fields are `collection` and `collections`.
- Knowledge item ownership field is `collectionId` in TypeScript and `collection_id` in SQLite.
