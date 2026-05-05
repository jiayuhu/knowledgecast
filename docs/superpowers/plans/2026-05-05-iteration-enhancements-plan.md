# 整理环节增强 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为整理页添加版本历史回退、素材覆盖分析和轻量文本编辑三项增强。

**Architecture:** 复用已有 `iterationHistory` 表存储版本快照；新增 `GET /api/training-pages/[id]/versions` 和 `PATCH /api/training-pages/[id]` 两个 API 端点；前端在 structure 页面内新增 VersionBar 组件、CoverageBanner 组件，SlidePreview 增加内联编辑能力。三个功能按版本历史 → 覆盖分析 → 轻量编辑的顺序实现。

**Tech Stack:** Next.js 15 + React 19 + Drizzle ORM + SQLite + TypeScript + Tailwind CSS v4

---

## 文件结构

```
Create:
  src/app/api/training-pages/[id]/route.ts                    — PATCH 处理器（更新 slidesJson）
  src/app/api/training-pages/[id]/versions/route.ts           — GET 版本列表
  src/app/api/training-pages/[id]/versions/[versionId]/route.ts — GET 单个版本快照
  src/components/workspace/VersionBar.tsx                     — 版本栏组件
  src/components/workspace/CoverageBanner.tsx                 — 覆盖提示条组件

Modify:
  src/server/training/service.ts                  — 生成时写入 iterationHistory；增加版本列表查询
  src/server/training/repository.ts               — 新增 iterationHistory CRUD + 版本链查询
  src/server/ai/prompts.ts                        — 追加覆盖分析提示词
  src/app/workspace/[id]/structure/page.tsx       — 集成 VersionBar + CoverageBanner + 编辑逻辑
  src/components/workspace/SlidePreview.tsx        — 内联编辑交互
  src/components/workspace/IterationPanel.tsx      — 移除版本号显示（移到 VersionBar）
  docs/api.md                                     — 新增 API 文档
```

---

### Task 1: 版本历史 — 服务端基础

**Files:**
- Modify: `src/server/training/repository.ts`

在 `repository.ts` 中新增 iterationHistory 的写入和查询函数。

- [ ] **Step 1: 新增 `saveVersionSnapshot` 和 `listVersions` 函数**

在 `D:\dev\knowledgecast\src\server\training\repository.ts` 中添加：

```typescript
import { iterationHistory } from "../db/schema";
import { asc } from "drizzle-orm";

export async function saveVersionSnapshot(input: {
  trainingPageId: string;
  version: number;
  instruction: string;
  slidesJson: string;
}) {
  const db = await getDb();
  await db.insert(iterationHistory).values({
    id: randomUUID(),
    trainingPageId: input.trainingPageId,
    version: input.version,
    instruction: input.instruction,
    slidesJson: input.slidesJson,
    createdAt: new Date()
  }).run();
}

export async function listVersions(trainingPageId: string) {
  const db = await getDb();
  const rows = await db
    .select({
      id: iterationHistory.id,
      version: iterationHistory.version,
      instruction: iterationHistory.instruction,
      createdAt: iterationHistory.createdAt
    })
    .from(iterationHistory)
    .where(eq(iterationHistory.trainingPageId, trainingPageId))
    .orderBy(asc(iterationHistory.version))
    .all();

  return rows;
}

export async function getVersionSnapshot(id: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(iterationHistory)
    .where(eq(iterationHistory.id, id))
    .all();
  return rows[0] ?? null;
}
```

- [ ] **Step 2: 类型检查验证**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
```

Expected: 无新增类型错误（iterationHistory 表已在 schema.ts 定义）。

- [ ] **Step 3: Commit**

```bash
git add src/server/training/repository.ts
git commit -m "feat: add iterationHistory write and query functions to repository"
```

---

### Task 2: 版本历史 — 生成时写入快照

**Files:**
- Modify: `src/server/training/service.ts`

在 `generateTrainingSlides` 中，每次迭代更新前先保存当前版本的快照。

- [ ] **Step 1: 修改 `generateTrainingSlides` 保存快照**

在 `D:\dev\knowledgecast\src\server\training\service.ts` 中：

在文件顶部 import 新增 `saveVersionSnapshot`：

```typescript
import {
  createTrainingPage,
  updateTrainingPage,
  saveVersionSnapshot
} from "./repository";
```

在 `generateTrainingSlides` 函数的迭代分支（`if (input.previousPageId)` 块内），在调用 `updateTrainingPage` 之前，插入快照保存：

找到第 161 行附近的 `if (input.previousPageId) {` 块，修改为：

```typescript
if (input.previousPageId) {
    // Save snapshot of previous version before overwriting
    if (previousSlides) {
      await saveVersionSnapshot({
        trainingPageId: input.previousPageId,
        version: version - 1,
        instruction: input.instruction ?? "首次生成",
        slidesJson: JSON.stringify(previousSlides)
      });
    }

    const trainingPage = await updateTrainingPage(input.previousPageId, {
      // ... 保持不变
    });
```

但是首次生成没有 `previousPageId`，所以不需要在首次生成时保存快照——首次生成的初始版本就是版本 1，后续迭代时才会把版本 1 的快照写入 history。

对于首次迭代（从版本 1 → 版本 2），需要在更新前将版本 1 的快照写入 `iterationHistory`。当前逻辑中，首次生成创建的 TrainingPage（version=1）没有对应的 iterationHistory 记录。所以在迭代分支中，检查 `trainingPageId` 在 `iterationHistory` 中是否有记录，如果没有则先补写首次生成的快照。

更好的做法：在迭代分支，始终保存 `previousSlides` 快照（如果有的话），instruction 用上一次的指令（或 "首次生成"）。

```typescript
if (input.previousPageId) {
    // Save current snapshot before overwriting with new version
    if (previousSlides) {
      const prevVersion = version - 1;
      const existingSnapshots = await listVersions(input.previousPageId);
      const snapshotExists = existingSnapshots.some(s => s.version === prevVersion);
      if (!snapshotExists) {
        await saveVersionSnapshot({
          trainingPageId: input.previousPageId,
          version: prevVersion,
          instruction: prevVersion === 1 ? "首次生成" : (input.instruction ?? "迭代调整"),
          slidesJson: JSON.stringify(previousSlides)
        });
      }
    }

    const trainingPage = await updateTrainingPage(input.previousPageId, {
```

同时需要在 import 中加入 `listVersions`：

```typescript
import {
  createTrainingPage,
  updateTrainingPage,
  saveVersionSnapshot,
  listVersions
} from "./repository";
```

并在文件顶部移除迭代分支内的动态 import，因为 `listRecentTrainingPages` 在同一模块中已通过顶部静态 import 可用。当前代码在第 135 行和第 171 行有 `const { listRecentTrainingPages } = await import("./repository");`——保持这些动态 import 不变，但需要单独顶部 import `saveVersionSnapshot` 和 `listVersions`。

- [ ] **Step 2: 类型检查**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
```

Expected: 无新增错误。

- [ ] **Step 3: Commit**

```bash
git add src/server/training/service.ts
git commit -m "feat: save iteration snapshots to history when iterating"
```

---

### Task 3: 版本历史 — API 端点

**Files:**
- Create: `src/app/api/training-pages/[id]/versions/route.ts`

- [ ] **Step 1: 创建版本列表 API**

创建 `D:\dev\knowledgecast\src\app\api\training-pages\[id]\versions\route.ts`：

```typescript
import { NextResponse } from "next/server";
import { listVersions } from "@/server/training/repository";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const versions = await listVersions(id);
    return NextResponse.json({ versions });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "获取版本列表失败" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: 验证 API 可访问**

启动 dev server 并用 curl 测试（需要先有 training page）：

```bash
curl -s http://localhost:3000/api/training-pages/<existing-id>/versions | head -100
```

Expected: 返回 `{ "versions": [...] }`。

- [ ] **Step 3: Commit**

```bash
git add src/app/api/training-pages/[id]/versions/route.ts
git commit -m "feat: add GET /api/training-pages/[id]/versions endpoint"
```

---

### Task 4: 版本历史 — 前端 VersionBar 组件

**Files:**
- Create: `src/components/workspace/VersionBar.tsx`
- Modify: `src/app/workspace/[id]/structure/page.tsx`
- Modify: `src/components/workspace/IterationPanel.tsx`

- [ ] **Step 1: 创建 VersionBar 组件**

创建 `D:\dev\knowledgecast\src\components\workspace\VersionBar.tsx`：

```typescript
"use client";

import { useState, useEffect } from "react";

type VersionSummary = {
  id: string;
  version: number;
  instruction: string;
  createdAt: number;
};

type Props = {
  currentVersion: number;
  trainingPageId: string;
  currentSlidesJson: string | null;
  onVersionSelect: (slidesJson: string, version: number) => void;
  onRestore: (slidesJson: string, targetVersion: number) => void;
  hasManualEdits: boolean;
};

export function VersionBar({
  currentVersion,
  trainingPageId,
  currentSlidesJson,
  onVersionSelect,
  onRestore,
  hasManualEdits
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [viewingVersion, setViewingVersion] = useState<number | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    fetch(`/api/training-pages/${trainingPageId}/versions`)
      .then(r => r.json())
      .then(data => setVersions(data.versions ?? []))
      .catch(() => {});
  }, [trainingPageId]);

  const totalVersions = versions.length;

  function handleSelectVersion(v: VersionSummary) {
    setViewingVersion(v.version);
    fetch(`/api/training-pages/${trainingPageId}/versions/${v.id}`)
      .then(r => r.json())
      .then(data => {
        if (data.slidesJson) onVersionSelect(data.slidesJson, v.version);
      })
      .catch(() => {});
  }

  function handleBackToCurrent() {
    setViewingVersion(null);
    if (currentSlidesJson) onVersionSelect(currentSlidesJson, currentVersion);
  }

  function handlePrevious() {
    const idx = versions.findIndex(v => v.version === (viewingVersion ?? currentVersion));
    if (idx > 0) handleSelectVersion(versions[idx - 1]);
  }

  function handleNext() {
    const idx = versions.findIndex(v => v.version === (viewingVersion ?? currentVersion));
    if (viewingVersion === null) return; // already on latest
    if (idx >= 0 && idx < versions.length - 1) handleSelectVersion(versions[idx + 1]);
    if (idx === versions.length - 1) handleBackToCurrent();
  }

  async function handleRestore() {
    if (!viewingVersion || viewingVersion === currentVersion) return;
    setRestoring(true);
    const v = versions.find(v => v.version === viewingVersion);
    if (!v) return;
    try {
      const res = await fetch(`/api/training-pages/${trainingPageId}/versions/${v.id}`);
      const data = await res.json();
      if (data.slidesJson) {
        onRestore(data.slidesJson, viewingVersion);
      }
    } finally {
      setRestoring(false);
    }
  }

  if (totalVersions === 0) return null;

  const currentDisplay = viewingVersion ?? currentVersion;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      {hasManualEdits && (
        <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
          ⚠ 已手动编辑，部分 AI 迭代可能导致手动修改丢失
        </p>
      )}

      <div className="flex items-center gap-2 text-sm">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-gray-500 hover:text-gray-700 font-medium"
        >
          版本历史 {expanded ? "▾" : "▸"}
        </button>
        <span className="text-gray-400">
          v{currentDisplay} / 共 {totalVersions + 1} 个版本
        </span>
        <span className="text-gray-300">|</span>
        <button
          onClick={handlePrevious}
          disabled={viewingVersion !== null && versions.findIndex(v => v.version === viewingVersion) === 0}
          className="text-gray-500 hover:text-gray-700 disabled:opacity-30"
        >
          ◀ 上一个
        </button>
        <button
          onClick={handleNext}
          disabled={viewingVersion === null}
          className="text-gray-500 hover:text-gray-700 disabled:opacity-30"
        >
          下一个 ▶
        </button>
        {viewingVersion !== null && viewingVersion !== currentVersion && (
          <>
            <span className="text-gray-300">|</span>
            <button
              onClick={handleRestore}
              disabled={restoring}
              className="text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
            >
              {restoring ? "恢复中..." : "↻ 恢复此版本"}
            </button>
            <button
              onClick={handleBackToCurrent}
              className="text-gray-400 hover:text-gray-600"
            >
              回到最新
            </button>
          </>
        )}
      </div>

      {expanded && (
        <div className="border-t border-gray-100 pt-2 max-h-48 overflow-y-auto space-y-1">
          {versions.map((v) => (
            <button
              key={v.id}
              onClick={() => handleSelectVersion(v)}
              className={`w-full flex items-center gap-2 rounded-md px-3 py-1.5 text-left text-xs transition ${
                v.version === viewingVersion
                  ? "bg-blue-50 text-blue-700"
                  : v.version === currentVersion && viewingVersion === null
                    ? "bg-gray-50 text-gray-700"
                    : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              <span className="font-mono">
                {v.version === currentVersion && viewingVersion === null ? "●" : "○"} v{v.version}
              </span>
              <span className="text-gray-400">
                {new Date(v.createdAt).toLocaleString("zh-CN", {
                  month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
                })}
              </span>
              <span className="flex-1 truncate text-gray-500">
                指令：「{v.instruction.slice(0, 30)}{v.instruction.length > 30 ? "..." : ""}」
              </span>
            </button>
          ))}
          <button
            onClick={handleBackToCurrent}
            className={`w-full flex items-center gap-2 rounded-md px-3 py-1.5 text-left text-xs ${
              viewingVersion === null ? "bg-blue-50 text-blue-700" : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            <span className="font-mono">● v{currentVersion}</span>
            <span className="text-gray-400">当前版本</span>
          </button>
        </div>
      )}
    </div>
  );
}
```

同时需要新增一个获取单个版本快照的 API。创建 `D:\dev\knowledgecast\src\app\api\training-pages\[id]\versions\[versionId]\route.ts`：

```typescript
import { NextResponse } from "next/server";
import { getVersionSnapshot } from "@/server/training/repository";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const { versionId } = await params;
  try {
    const snapshot = await getVersionSnapshot(versionId);
    if (!snapshot) {
      return NextResponse.json({ error: "版本不存在" }, { status: 404 });
    }
    return NextResponse.json({
      id: snapshot.id,
      slidesJson: snapshot.slidesJson,
      version: snapshot.version,
      instruction: snapshot.instruction,
      createdAt: snapshot.createdAt
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "获取版本失败" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: 集成到 structure page**

在 `D:\dev\knowledgecast\src\app\workspace\[id]\structure\page.tsx` 中：

新增 import：
```typescript
import { VersionBar } from "@/components/workspace/VersionBar";
```

新增 state：
```typescript
const [previewSlidesJson, setPreviewSlidesJson] = useState<string | null>(null);
const [restoringVersion, setRestoringVersion] = useState(false);
const [hasManualEdits, setHasManualEdits] = useState(false);
```

新增恢复处理函数：
```typescript
async function handleRestore(restoreSlidesJson: string, targetVersion: number) {
  if (!result) return;
  setRestoringVersion(true);
  try {
    const parsed = JSON.parse(restoreSlidesJson);
    const res = await fetch(`/api/training-pages/${result.trainingPage.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        slidesJson: restoreSlidesJson,
        title: parsed.title,
        totalMinutes: parsed.totalMinutes,
        version: (result.trainingPage.version ?? 1) + 1,
        restoreInstruction: `恢复到 v${targetVersion}`,
        preRestoreVersion: result.trainingPage.version ?? 1,
        preRestoreSlidesJson: result.trainingPage.slidesJson
      })
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error ?? "恢复失败");
    }
    const updated = await res.json() as TrainingResult;
    setResult(updated);
    setPreviewSlidesJson(null);
    setHasManualEdits(false);
    setMessage("已恢复");
  } catch (e) {
    setMessage(e instanceof Error ? e.message : "恢复失败");
  } finally {
    setRestoringVersion(false);
  }
}
```

VersionBar 的 `onRestore` 回调传入 target version：
```tsx
onRestore={handleRestore}
```

渲染 `slides` 时，优先使用预览版本：
```typescript
const slidesJson = previewSlidesJson ?? result?.trainingPage.slidesJson;
const slides: Slide[] = slidesJson ? JSON.parse(slidesJson).slides : [];
```

VersionBar 插入在迭代面板之前、消息之后（紧邻 `{result?.shareLink && <ShareLinkCard ... />}` 之前）：

```tsx
{result && (
  <VersionBar
    currentVersion={result.trainingPage.version ?? 1}
    trainingPageId={result.trainingPage.id}
    currentSlidesJson={result.trainingPage.slidesJson}
    onVersionSelect={(json, _version) => setPreviewSlidesJson(json)}
    onRestore={handleRestore}
    hasManualEdits={hasManualEdits}
  />
)}
```

- [ ] **Step 3: 移除 IterationPanel 中的版本号显示**

在 `D:\dev\knowledgecast\src\components\workspace\IterationPanel.tsx` 中，移除 `version` prop 和其显示，因为版本号已移至 VersionBar。

移除 Props 中的 `version: number;`，移除 JSX 中的 `<span className="text-xs text-gray-400">版本 {version}</span>`，更新调用处传入的 `version` prop。

- [ ] **Step 4: 类型检查**

```bash
npx tsc --noEmit --pretty 2>&1 | head -50
```

Expected: 无类型错误。

- [ ] **Step 5: Commit**

```bash
git add src/components/workspace/VersionBar.tsx \
        src/app/workspace/\[id\]/structure/page.tsx \
        src/components/workspace/IterationPanel.tsx \
        src/app/api/training-pages/\[id\]/versions/\[versionId\]/route.ts
git commit -m "feat: add VersionBar component with history browsing and restore"
```

---

### Task 5: 版本历史 — PATCH 端点

**Files:**
- Create: `src/app/api/training-pages/[id]/route.ts`

- [ ] **Step 1: 创建 PATCH /api/training-pages/[id]**

创建 `D:\dev\knowledgecast\src\app\api\training-pages\[id]\route.ts`：

```typescript
import { NextResponse } from "next/server";
import { updateTrainingPage, saveVersionSnapshot } from "@/server/training/repository";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { userId, slidesJson, title, totalMinutes, version, restoreInstruction, preRestoreVersion, preRestoreSlidesJson } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId 必填" }, { status: 400 });
    }

    // On restore, save the current state as a snapshot so user can undo
    if (restoreInstruction && preRestoreVersion && preRestoreSlidesJson) {
      await saveVersionSnapshot({
        trainingPageId: id,
        version: preRestoreVersion,
        instruction: "恢复到 v" + preRestoreVersion,
        slidesJson: preRestoreSlidesJson
      });
    }

    const updated = await updateTrainingPage(id, {
      title: title ?? undefined,
      slidesJson: slidesJson ?? undefined,
      totalMinutes: totalMinutes ?? undefined,
      version: version ?? undefined,
      status: "ready"
    });

    // Save the restored version itself as a snapshot
    if (restoreInstruction && version) {
      await saveVersionSnapshot({
        trainingPageId: id,
        version: version,
        instruction: restoreInstruction,
        slidesJson: slidesJson
      });
    }

    return NextResponse.json({
      trainingPage: {
        id: updated.id,
        userId: updated.userId,
        title: updated.title,
        framework: updated.framework,
        slidesJson: updated.slidesJson,
        totalMinutes: updated.totalMinutes,
        version: updated.version,
        status: updated.status,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt
      },
      shareLink: null
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "更新失败" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: 类型检查**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/training-pages/\[id\]/route.ts
git commit -m "feat: add PATCH endpoint for training page updates and restore"
```

---

### Task 6: 素材覆盖分析 — Prompt 调整

**Files:**
- Modify: `src/server/ai/prompts.ts`

- [ ] **Step 1: 追加覆盖分析指令**

在 `D:\dev\knowledgecast\src\server\ai\prompts.ts` 的 `buildSlideGenerationPrompt` 函数中，在 `lines.push(...)` 的 "要求" 块末尾（`"如果素材不足以支撑某个环节..."` 行）改为：

```typescript
lines.push(
  `请按照「${framework.name}」框架组织内容，框架结构为：${framework.structure.join(" → ")}。`,
  "针对框架的每个环节生成一页幻灯片。",
  "",
  "每页幻灯片包含：",
  "- title: 该页标题，简洁有力",
  "- bullets: 3-5 个要点，每点一句话，便于口头展开",
  "- speakerNotes: 讲者备注（1-3句话），提醒讲师这页的核心要点、可以举什么例子、注意什么",
  "- estimatedMinutes: 预估讲述时长（分钟数），整页内容合理预估",
  "",
  "要求：",
  "- 保留原始素材的核心观点，去重合并",
  "- 幻灯片之间要有逻辑递进",
  "- 讲者备注要有实操性，不是重复要点而是补充讲解技巧",
  "- 总时长控制在合理范围（一般 15-45 分钟）",
  "- 对每个环节评估素材是否足够支撑该环节内容。如果某环节素材明显不足，在该环节第一张幻灯片的 speakerNotes 中以「[素材不足] 建议补充：XX」开头给出具体建议。如果素材充足则不添加此标记"
);
```

- [ ] **Step 2: 类型检查**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/server/ai/prompts.ts
git commit -m "feat: add coverage analysis markers to slide generation prompt"
```

---

### Task 7: 素材覆盖分析 — CoverageBanner 组件

**Files:**
- Create: `src/components/workspace/CoverageBanner.tsx`
- Modify: `src/app/workspace/[id]/structure/page.tsx`

- [ ] **Step 1: 创建 CoverageBanner 组件**

创建 `D:\dev\knowledgecast\src\components\workspace\CoverageBanner.tsx`：

```typescript
"use client";

type Slide = {
  title: string;
  bullets: string[];
  speakerNotes: string;
  estimatedMinutes: number;
};

type Props = {
  slides: Slide[];
  frameworkSteps: number;
  materialCount: number;
};

function parseCoverage(slides: Slide[]): { totalSteps: number; missingSteps: string[]; suggestions: string[] } {
  const missingSteps: string[] = [];
  const suggestions: string[] = [];

  for (const slide of slides) {
    const match = slide.speakerNotes.match(/^\[素材不足\]\s*建议补充：(.+)$/m);
    if (match) {
      missingSteps.push(slide.title);
      suggestions.push(match[1].trim());
    }
  }

  return {
    totalSteps: slides.length,
    missingSteps,
    suggestions
  };
}

export function CoverageBanner({ slides, frameworkSteps, materialCount }: Props) {
  // Pre-generation hint
  if (slides.length === 0 && frameworkSteps > 0) {
    const ratio = materialCount / frameworkSteps;
    const color = ratio >= 2 ? "text-green-600" : ratio >= 1 ? "text-amber-600" : "text-red-600";
    return (
      <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-2 text-xs text-gray-500">
        你有 {materialCount} 条素材，当前框架有 {frameworkSteps} 个环节。
        <span className={`font-medium ${color}`}> 建议每个环节至少 2 条素材。</span>
      </div>
    );
  }

  // Post-generation coverage summary
  if (slides.length === 0) return null;

  const { totalSteps, missingSteps, suggestions } = parseCoverage(slides);
  const sufficientCount = totalSteps - missingSteps.length;

  if (missingSteps.length === 0) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-xs text-green-700">
        ✓ 素材覆盖：{totalSteps}/{totalSteps} 环节充足
      </div>
    );
  }

  const borderColor = missingSteps.length >= 3
    ? "border-red-200"
    : "border-amber-200";
  const bgColor = missingSteps.length >= 3
    ? "bg-red-50"
    : "bg-amber-50";
  const textColor = missingSteps.length >= 3
    ? "text-red-700"
    : "text-amber-700";
  const icon = missingSteps.length >= 3 ? "✗" : "⚠️";

  return (
    <div className={`rounded-lg border ${borderColor} ${bgColor} px-4 py-2 text-xs ${textColor}`}>
      {icon} 素材覆盖：{sufficientCount}/{totalSteps} 环节充足。
      「{missingSteps.join("」「")}」环节素材不足
      {suggestions.length > 0 && `，建议补充：${suggestions.join("；")}`}
    </div>
  );
}
```

- [ ] **Step 2: 集成到 structure page**

在 `D:\dev\knowledgecast\src\app\workspace\[id]\structure\page.tsx` 中：

新增 import：
```typescript
import { CoverageBanner } from "@/components/workspace/CoverageBanner";
```

新增 state 获取框架步骤数（如果有选中的框架）：
```typescript
// frameworkSteps can be derived from frameworkId via the frameworks API
const [frameworkSteps, setFrameworkSteps] = useState(0);
```

在 `FrameworkPicker` 的 `onSelect` 回调中同步更新（或者直接从 `frameworks` 列表计算）。简化处理：在生成按钮之前、素材选择之后插入 CoverageBanner（生成前模式），在幻灯片预览上方插入（生成后模式）。

生成前（在生成按钮上方）：
```tsx
<CoverageBanner slides={[]} frameworkSteps={frameworkSteps} materialCount={fragments.length} />
```

生成后（在 VersionBar 之后、SlidePreview 之前）：
```tsx
{slides.length > 0 && (
  <CoverageBanner slides={slides} frameworkSteps={frameworkSteps} materialCount={fragments.length} />
)}
```

需要从 FrameworkPicker 获取选中的框架结构长度。修改 structure page 以维护 `frameworks` 列表（从 FrameworkPicker 回调获取）：

在 `handleFrameworkSelect` 中：
```typescript
function handleFrameworkSelect(fid: string, stepsCount: number) {
  setFrameworkId(fid);
  setFrameworkSteps(stepsCount);
}
```

更简单的做法：直接从右侧已有的框架数据推断。由于 `FrameworkPicker` 内部获取了框架（内置+自定义，包含 structure），在 structure page 中额外调用一次获取步骤数最简单：

```typescript
useEffect(() => {
  if (!frameworkId) { setFrameworkSteps(0); return; }
  fetch(`/api/frameworks?userId=demo-user`)
    .then(r => r.json())
    .then(data => {
      const fws = (data.frameworks ?? []) as Array<{ id: string; structure: string[] }>;
      const fw = fws.find(f => f.id === frameworkId);
      setFrameworkSteps(fw?.structure.length ?? 0);
    })
    .catch(() => {});
}, [frameworkId]);
```

- [ ] **Step 3: 类型检查**

```bash
npx tsc --noEmit --pretty 2>&1 | head -50
```

- [ ] **Step 4: Commit**

```bash
git add src/components/workspace/CoverageBanner.tsx src/app/workspace/\[id\]/structure/page.tsx
git commit -m "feat: add coverage banner with pre/post generation analysis"
```

---

### Task 8: 轻量文本编辑 — SlidePreview 内联编辑

**Files:**
- Modify: `src/components/workspace/SlidePreview.tsx`

- [ ] **Step 1: 添加内联编辑能力**

修改 `D:\dev\knowledgecast\src\components\workspace\SlidePreview.tsx`：

```typescript
"use client";

import { useState } from "react";

type Slide = {
  title: string;
  bullets: string[];
  speakerNotes: string;
  estimatedMinutes: number;
};

type Props = {
  slides: Slide[];
  title: string;
  totalMinutes: number;
  shareUrl: string;
  editingEnabled?: boolean;
  onSlidesChange?: (slides: Slide[]) => void;
};

export function SlidePreview({ slides, title, totalMinutes, shareUrl, editingEnabled = false, onSlidesChange }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showNotes, setShowNotes] = useState(true);
  const [editingField, setEditingField] = useState<string | null>(null);

  if (slides.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
        <div className="text-4xl">📊</div>
        <p className="mt-4 text-sm text-gray-500">选择框架并点击生成后，幻灯片将展示在这里</p>
        <p className="mt-1 text-xs text-gray-400">AI 会将碎片素材组织为结构化的培训幻灯片</p>
      </div>
    );
  }

  const slide = slides[currentIndex];

  function updateSlide(field: string, value: unknown) {
    if (!onSlidesChange) return;
    const updated = slides.map((s, i) => {
      if (i !== currentIndex) return s;
      return { ...s, [field]: value };
    });
    onSlidesChange(updated);
  }

  function updateBullet(bulletIndex: number, value: string) {
    if (!onSlidesChange) return;
    const updatedBullets = slide.bullets.map((b, i) => i === bulletIndex ? value : b);
    updateSlide("bullets", updatedBullets);
  }

  function addBullet() {
    if (!onSlidesChange) return;
    updateSlide("bullets", [...slide.bullets, ""]);
  }

  function deleteBullet(bulletIndex: number) {
    if (!onSlidesChange || slide.bullets.length <= 1) return;
    const updatedBullets = slide.bullets.filter((_, i) => i !== bulletIndex);
    updateSlide("bullets", updatedBullets);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900">{title}</h2>
            <p className="mt-1 text-sm text-gray-500">
              共 {slides.length} 页 · 预估时长 {totalMinutes} 分钟
            </p>
          </div>
          {shareUrl && (
            <div className="text-right">
              <a
                href={`${shareUrl}?preview=1`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                预览分享页
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Slide navigation */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
          className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition hover:bg-gray-50 disabled:opacity-40"
        >
          ← 上一页
        </button>
        <span className="text-sm text-gray-400">
          {currentIndex + 1} / {slides.length}
        </span>
        <button
          onClick={() =>
            setCurrentIndex(Math.min(slides.length - 1, currentIndex + 1))
          }
          disabled={currentIndex === slides.length - 1}
          className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition hover:bg-gray-50 disabled:opacity-40"
        >
          下一页 →
        </button>
        <div className="flex-1" />
        <button
          onClick={() => setShowNotes(!showNotes)}
          className={`rounded-md border px-3 py-1.5 text-sm transition ${
            showNotes
              ? "border-blue-200 bg-blue-50 text-blue-700"
              : "border-gray-200 text-gray-500 hover:bg-gray-50"
          }`}
        >
          {showNotes ? "隐藏备注" : "讲者备注"}
        </button>
      </div>

      {/* Current slide */}
      <div className="rounded-xl border border-gray-200 bg-white p-8">
        <div className="flex items-center justify-between mb-6">
          <span className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-500">
            第 {currentIndex + 1} 页
          </span>
          <span className="text-xs text-gray-400">~{slide.estimatedMinutes} 分钟</span>
        </div>

        {/* Editable title */}
        {editingEnabled && editingField === `title-${currentIndex}` ? (
          <input
            autoFocus
            value={slide.title}
            onChange={(e) => updateSlide("title", e.target.value)}
            onBlur={() => setEditingField(null)}
            onKeyDown={(e) => { if (e.key === "Enter") setEditingField(null); }}
            className="w-full text-xl font-bold text-gray-900 bg-transparent border-b-2 border-blue-400 outline-none pb-0.5"
          />
        ) : (
          <h3
            onClick={() => editingEnabled && setEditingField(`title-${currentIndex}`)}
            className={`text-xl font-bold text-gray-900 ${editingEnabled ? "cursor-pointer hover:text-blue-600 transition" : ""}`}
          >
            {slide.title}
          </h3>
        )}

        {/* Editable bullets */}
        <ul className="mt-6 space-y-3">
          {slide.bullets.map((bullet, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-gray-700 group">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
              {editingEnabled && editingField === `bullet-${currentIndex}-${i}` ? (
                <input
                  autoFocus
                  value={bullet}
                  onChange={(e) => updateBullet(i, e.target.value)}
                  onBlur={() => setEditingField(null)}
                  onKeyDown={(e) => { if (e.key === "Enter") setEditingField(null); }}
                  className="flex-1 bg-transparent border-b border-blue-300 outline-none text-sm"
                />
              ) : (
                <span
                  onClick={() => editingEnabled && setEditingField(`bullet-${currentIndex}-${i}`)}
                  className={`flex-1 ${editingEnabled ? "cursor-text hover:bg-gray-50 rounded px-1 -mx-1" : ""}`}
                >
                  {bullet}
                </span>
              )}
              {editingEnabled && (
                <button
                  onClick={() => deleteBullet(i)}
                  className="shrink-0 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-xs transition"
                  title="删除要点"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>

        {editingEnabled && (
          <button
            onClick={addBullet}
            className="mt-2 ml-5 text-xs text-gray-400 hover:text-blue-600 transition"
          >
            + 添加要点
          </button>
        )}

        {/* Editable speaker notes */}
        {showNotes && (
          <div className="mt-8 rounded-lg border border-dashed border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium uppercase tracking-wide text-amber-700">
                讲者备注
              </span>
            </div>
            {editingEnabled && editingField === `notes-${currentIndex}` ? (
              <textarea
                autoFocus
                value={slide.speakerNotes}
                onChange={(e) => updateSlide("speakerNotes", e.target.value)}
                onBlur={() => setEditingField(null)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); setEditingField(null); } }}
                rows={3}
                className="w-full text-sm leading-relaxed bg-transparent border border-amber-300 rounded-md p-2 outline-none focus:ring-1 focus:ring-amber-200 resize-none"
              />
            ) : (
              <p
                onClick={() => editingEnabled && setEditingField(`notes-${currentIndex}`)}
                className={`text-sm leading-relaxed text-amber-900 ${editingEnabled ? "cursor-text hover:bg-amber-100 rounded px-1 -mx-1 transition" : ""}`}
              >
                {slide.speakerNotes}
              </p>
            )}
          </div>
        )}
      </div>

      {/* All slides overview */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="text-sm font-medium uppercase tracking-wide text-gray-500 mb-4">
          全部幻灯片
        </h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {slides.map((s, i) => (
            <button
              key={i}
              onClick={() => { setCurrentIndex(i); setEditingField(null); }}
              className={`rounded-lg border p-3 text-left transition ${
                i === currentIndex
                  ? "border-blue-300 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">#{i + 1}</span>
                <span className="text-xs text-gray-400">{s.estimatedMinutes}min</span>
              </div>
              <p className="mt-1 text-sm font-medium text-gray-900 line-clamp-2">{s.title}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 类型检查**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/components/workspace/SlidePreview.tsx
git commit -m "feat: add inline editing for slide title, bullets, and speaker notes"
```

---

### Task 9: 轻量文本编辑 — Debounce 保存到服务端

**Files:**
- Modify: `src/app/workspace/[id]/structure/page.tsx`

- [ ] **Step 1: 添加 debounced save 逻辑**

在 `D:\dev\knowledgecast\src\app\workspace\[id]\structure\page.tsx` 中：

新增 state：
```typescript
const [saveTimer, setSaveTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
```

新增 slides 变更处理函数：
```typescript
function handleSlidesChange(updatedSlides: Slide[]) {
  if (!result) return;
  setHasManualEdits(true);

  const slidesJson = result.trainingPage.slidesJson;
  if (!slidesJson) return;
  const parsed = JSON.parse(slidesJson);
  const updated = { ...parsed, slides: updatedSlides };
  const newSlidesJson = JSON.stringify(updated);

  // Update local state immediately
  setResult({
    ...result,
    trainingPage: { ...result.trainingPage, slidesJson: newSlidesJson }
  });

  // Debounce save to server
  if (saveTimer) clearTimeout(saveTimer);
  const timer = setTimeout(async () => {
    await fetch(`/api/training-pages/${result.trainingPage.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, slidesJson: newSlidesJson })
    });
  }, 500);
  setSaveTimer(timer);
}
```

更新 `SlidePreview` 调用，传入编辑 props：
```tsx
<SlidePreview
  slides={slides}
  title={result?.trainingPage.title ?? ""}
  totalMinutes={result?.trainingPage.totalMinutes ?? 0}
  shareUrl={result?.shareLink ? `/share/${result.shareLink.token}` : ""}
  editingEnabled={true}
  onSlidesChange={handleSlidesChange}
/>
```

- [ ] **Step 2: 类型检查**

```bash
npx tsc --noEmit --pretty 2>&1 | head -50
```

- [ ] **Step 3: Commit**

```bash
git add src/app/workspace/\[id\]/structure/page.tsx
git commit -m "feat: add debounced save for manual slide edits"
```

---

### Task 10: 文档更新 + 端到端验证

**Files:**
- Modify: `docs/api.md`
- Modify: `docs/superpowers/specs/2026-04-25-knowledgecast-design.md` (如有相关章节变更)

- [ ] **Step 1: 更新 API 文档**

在 `D:\dev\knowledgecast\docs\api.md` 的「培训页」部分，追加：

````markdown
### `GET /api/training-pages/[id]/versions`

获取培训页的版本历史列表。

**返回** `{ versions: { id: string; version: number; instruction: string; createdAt: number }[] }`

### `GET /api/training-pages/[id]/versions/[versionId]`

获取单个版本的完整快照。

**返回** `{ id: string; slidesJson: string; version: number; instruction: string; createdAt: number }`

### `PATCH /api/training-pages/[id]`

更新培训页的幻灯片内容。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | path | 是 | 培训页 ID |
| userId | body | 是 | |
| slidesJson | body | 否 | 更新后的幻灯片 JSON |
| title | body | 否 | |
| totalMinutes | body | 否 | |
| version | body | 否 | |
| restoreInstruction | body | 否 | 恢复操作时传入，会写入版本历史 |
````

- [ ] **Step 2: 端到端验证**

启动 dev server，手动验证以下流程：

1. 进入一个工作集的整理页
2. 选择框架 → 选择素材 → 生成幻灯片
3. 输入调整指令 → 迭代一次
4. 确认 VersionBar 出现，显示 2 个版本（包括首次生成）
5. 展开版本列表，点击历史版本 → 幻灯片区域切换显示
6. 点击恢复 → 确认版本回退
7. 点击幻灯片标题 → 确认可内联编辑
8. 编辑后确认顶部出现「已手动编辑」警告
9. 确认 CoverageBanner 在生成前显示素材/环节数量提示
10. 确认生成后若 AI 标注了 [素材不足] 则显示覆盖警告条

```bash
# Start dev server
npm run dev
```

- [ ] **Step 3: 运行已有测试确保无回归**

```bash
npx vitest run 2>&1 | tail -20
```

Expected: 所有已有测试通过。

- [ ] **Step 4: Commit**

```bash
git add docs/api.md
git commit -m "docs: add training page version and PATCH API documentation"
```

---

## 自审结果

1. **Spec 覆盖**: 三个功能均有对应任务。Task 1-5 实现版本历史，Task 6-7 实现覆盖分析，Task 8-9 实现轻量编辑，Task 10 文档和验证。
2. **占位符检查**: 所有步骤均包含实际代码，无 TBD/TODO。
3. **类型一致性**: VersionBar 的 props 类型与 structure page 传入的值一致；SlidePreview 的 `editingEnabled`/`onSlidesChange` 与调用处匹配；API 返回格式在前后端一致。
