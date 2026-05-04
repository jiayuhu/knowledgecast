# URL 内容获取与图片保存实现计划

> **给执行者：** 使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 按任务逐步实现。步骤使用 checkbox（`- [ ]`）跟踪进度。

**目标：** 当用户提交 URL 作为知识条目时，通过 MarkItDown MCP 获取页面正文，提取干净的 Markdown，下载文中引用的图片到本地存储，并将图片 URL 改写为本地路径。

**架构：** MarkItDown MCP 客户端通过 HTTP 调用 sidecar 服务将 URL 转为 Markdown。图片处理器解析 MD 中的图片引用，下载图片，用内容哈希去重，通过可插拔的 StorageAdapter 保存。Ingest 管线重构后编排这些步骤，MarkItDown 不可达时优雅降级。

**技术栈：** TypeScript、Next.js API Routes、MarkItDown MCP（Python sidecar）、Node.js `fetch` + `crypto`、文件系统存储（开发）/ 抽象适配器（生产）。

---

## 文件结构

| 文件 | 用途 |
|------|------|
| `src/server/storage/adapter.ts`（新建） | `StorageAdapter` 接口 + 文件系统实现 |
| `src/server/ingest/markitdown-client.ts`（新建） | MarkItDown MCP JSON-RPC HTTP 客户端 |
| `src/server/ingest/image-handler.ts`（新建） | 解析 MD 图片、下载、URL 重写 |
| `src/server/ingest/url.ts`（修改） | 新增 `isUrl()` 辅助函数，保留 `normalizeUrl()` |
| `src/server/ingest/normalize.ts`（修改） | URL 分支集成 MarkItDown 获取 |
| `src/server/ingest/storage.ts`（修改） | 编排新管线，传递 `originalUrl` |
| `src/server/db/schema.ts`（修改） | `knowledge_items` 表新增 `original_url` 列 |
| `src/server/knowledge/repository.ts`（修改） | record 类型和所有查询加入 `originalUrl` |
| `src/app/api/knowledge-items/route.ts`（修改） | POST 改为调用 ingest 管线 |
| `package.json`（修改） | 新增 `concurrently` 依赖、`dev:all` 脚本 |
| Tests（新建/修改） | 各模块单元测试 |

---

### 任务 1：Schema 新增 `original_url` 列

**涉及文件：**
- 修改：`src/server/db/schema.ts:23-33`

- [ ] **步骤 1：在 knowledgeItems 表新增 `originalUrl` 列**

```typescript
export const knowledgeItems = sqliteTable("knowledge_items", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  workspaceId: text("workspace_id"),
  sourceType: text("source_type").notNull(),
  title: text("title"),
  content: text("content").notNull(),
  originalUrl: text("original_url"),  // <-- new
  status: text("status").notNull().default("draft"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});
```

- [ ] **步骤 2：生成 migration**

运行：`npx drizzle-kit generate`
预期：`drizzle/` 下生成新 SQL 文件，包含 `ALTER TABLE knowledge_items ADD original_url text;`

- [ ] **步骤 3：验证 migration 可正常执行**

运行：`npx tsx -e "import { getDb } from '@/server/db/client'; await getDb(); console.log('OK')"`
预期：输出 "OK"（启动时 migration 无报错）

- [ ] **步骤 4：提交**

```bash
git add src/server/db/schema.ts drizzle/
git commit -m "feat: add original_url column to knowledge_items"
```

---

### Task 2: Create Storage Adapter Interface + Filesystem Implementation

**Files:**
- Create: `src/server/storage/adapter.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/server/storage.test.ts`:

```typescript
import { describe, expect, it, afterEach } from "vitest";
import { createLocalStorageAdapter } from "@/server/storage/adapter";
import fs from "node:fs";
import path from "node:path";

const TEST_DIR = path.resolve(process.cwd(), "tests/fixtures/storage");

describe("LocalStorageAdapter", () => {
  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true });
    }
  });

  it("saves a file and returns the public path", async () => {
    const adapter = createLocalStorageAdapter(TEST_DIR, "/storage");
    const buffer = Buffer.from("fake-image-data");
    const publicPath = await adapter.save("test.png", buffer);

    expect(publicPath).toBe("/storage/test.png");
    expect(fs.existsSync(path.join(TEST_DIR, "test.png"))).toBe(true);
  });

  it("creates subdirectories automatically", async () => {
    const adapter = createLocalStorageAdapter(TEST_DIR, "/storage");
    await adapter.save("a/b/c.txt", Buffer.from("hello"));

    expect(fs.existsSync(path.join(TEST_DIR, "a/b/c.txt"))).toBe(true);
  });

  it("deletes a file", async () => {
    const adapter = createLocalStorageAdapter(TEST_DIR, "/storage");
    await adapter.save("del.txt", Buffer.from("x"));
    await adapter.delete("del.txt");

    expect(fs.existsSync(path.join(TEST_DIR, "del.txt"))).toBe(false);
  });

  it("delete throws on missing file", async () => {
    const adapter = createLocalStorageAdapter(TEST_DIR, "/storage");
    await expect(adapter.delete("nonexistent.txt")).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/storage.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement the adapter**

Create `src/server/storage/adapter.ts`:

```typescript
import fs from "node:fs/promises";
import path from "node:path";

export interface StorageAdapter {
  /** Save a file, returns the public URL path */
  save(filename: string, buffer: Buffer): Promise<string>;
  /** Delete a file by filename */
  delete(filename: string): Promise<void>;
}

export function createLocalStorageAdapter(
  baseDir: string,
  publicPrefix: string
): StorageAdapter {
  return {
    async save(filename: string, buffer: Buffer): Promise<string> {
      const fullPath = path.join(baseDir, filename);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, buffer);
      return `${publicPrefix}/${filename}`;
    },

    async delete(filename: string): Promise<void> {
      const fullPath = path.join(baseDir, filename);
      await fs.unlink(fullPath);
    }
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/server/storage.test.ts`
Expected: 4 PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/storage/adapter.ts tests/server/storage.test.ts tests/fixtures/
git commit -m "feat: add storage adapter interface and local filesystem implementation"
```

---

### Task 3: Create MarkItDown MCP Client

**Files:**
- Create: `src/server/ingest/markitdown-client.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/server/markitdown-client.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createMarkItDownClient } from "@/server/ingest/markitdown-client";

describe("createMarkItDownClient", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("initializes MCP session and calls convert_to_markdown", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jsonrpc: "2.0",
          id: 1,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: { name: "markitdown", version: "0.1.0" }
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jsonrpc: "2.0",
          id: 2,
          result: {
            content: [
              { type: "text", text: "# Page Title\n\nClean content here." }
            ]
          }
        })
      });

    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const client = createMarkItDownClient("http://localhost:3001/mcp");
    const result = await client.convertUrl("https://example.com/article");

    expect(result).toBe("# Page Title\n\nClean content here.");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("returns null when MarkItDown is unreachable", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED")) as unknown as typeof fetch;

    const client = createMarkItDownClient("http://localhost:3001/mcp");
    const result = await client.convertUrl("https://example.com");

    expect(result).toBeNull();
  });

  it("returns null when MarkItDown returns empty content", async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jsonrpc: "2.0",
          id: 1,
          result: { protocolVersion: "2024-11-05", capabilities: {}, serverInfo: {} }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jsonrpc: "2.0",
          id: 2,
          result: { content: [] }
        })
      }) as unknown as typeof fetch;

    const client = createMarkItDownClient("http://localhost:3001/mcp");
    const result = await client.convertUrl("https://example.com");

    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/markitdown-client.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement the client**

Create `src/server/ingest/markitdown-client.ts`:

```typescript
let sessionInitialized = false;

async function ensureInitialized(mcpUrl: string): Promise<void> {
  if (sessionInitialized) return;

  const initRes = await fetch(mcpUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "knowledgecast", version: "1.0.0" }
      }
    })
  });

  if (!initRes.ok) {
    throw new Error(`MarkItDown init failed: ${initRes.status}`);
  }

  const initData = await initRes.json();
  if (initData.error) {
    throw new Error(`MarkItDown init error: ${initData.error.message}`);
  }

  // Send initialized notification
  await fetch(mcpUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized"
    })
  });

  sessionInitialized = true;
}

export function createMarkItDownClient(mcpUrl: string) {
  return {
    async convertUrl(url: string): Promise<string | null> {
      try {
        await ensureInitialized(mcpUrl);

        const res = await fetch(mcpUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            method: "tools/call",
            params: {
              name: "convert_to_markdown",
              arguments: { uri: url }
            }
          })
        });

        if (!res.ok) return null;
        const data = await res.json();
        if (data.error) return null;

        const content = data.result?.content;
        if (!content || content.length === 0) return null;

        return content[0].text ?? null;
      } catch {
        return null; // Graceful fallback: MarkItDown unreachable
      }
    }
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/server/markitdown-client.test.ts`
Expected: 3 PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/ingest/markitdown-client.ts tests/server/markitdown-client.test.ts
git commit -m "feat: add MarkItDown MCP client for URL-to-markdown conversion"
```

---

### Task 4: Create Image Handler

**Files:**
- Create: `src/server/ingest/image-handler.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/server/image-handler.test.ts`:

```typescript
import { describe, expect, it, vi, afterEach } from "vitest";
import { createImageHandler } from "@/server/ingest/image-handler";
import type { StorageAdapter } from "@/server/storage/adapter";

describe("createImageHandler", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockAdapter(): StorageAdapter {
    const files = new Map<string, Buffer>();
    return {
      async save(filename, buffer) {
        files.set(filename, buffer);
        return `/images/${filename}`;
      },
      async delete(filename) {
        files.delete(filename);
      }
    };
  }

  it("downloads images and rewrites markdown URLs", async () => {
    const png1x1 = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => png1x1.buffer
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => png1x1.buffer
      }) as unknown as typeof fetch;

    const handler = createImageHandler(mockAdapter());
    const markdown = [
      "# Title",
      "",
      "![diagram](https://example.com/img/diagram.png)",
      "",
      "![photo](https://example.com/photo.jpg)"
    ].join("\n");

    const result = await handler.processImages(markdown, "https://example.com/page");

    expect(result.markdown).not.toContain("https://example.com");
    expect(result.markdown).toContain("![diagram](/images/");
    expect(result.markdown).toContain("![photo](/images/");
    expect(result.images).toHaveLength(2);
    expect(result.images[0].originalUrl).toBe("https://example.com/img/diagram.png");
    expect(result.images[0].localPath).toMatch(/^\/images\/[a-f0-9]+\.png$/);
  });

  it("keeps original URL when image download fails", async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 404 }) as unknown as typeof fetch;

    const handler = createImageHandler(mockAdapter());
    const markdown = "![broken](https://example.com/missing.png)";

    const result = await handler.processImages(markdown, "https://example.com");

    expect(result.markdown).toBe(markdown);
    expect(result.images).toHaveLength(0);
  });

  it("resolves relative image URLs", async () => {
    const png1x1 = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => png1x1.buffer
      }) as unknown as typeof fetch;

    const handler = createImageHandler(mockAdapter());
    const markdown = "![rel](./img/relative.png)";

    const result = await handler.processImages(markdown, "https://example.com/page/article");

    // Should resolve relative to https://example.com/page/img/relative.png
    const capturedUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(capturedUrl).toBe("https://example.com/page/img/relative.png");
  });

  it("returns markdown unchanged when no images present", async () => {
    const handler = createImageHandler(mockAdapter());
    const markdown = "# Just text\n\nNo images here.";

    const result = await handler.processImages(markdown, "https://example.com");

    expect(result.markdown).toBe(markdown);
    expect(result.images).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/image-handler.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement the image handler**

Create `src/server/ingest/image-handler.ts`:

```typescript
import { createHash } from "node:crypto";
import type { StorageAdapter } from "../storage/adapter";

type ImageRecord = {
  originalUrl: string;
  localPath: string;
  hash: string;
};

type ProcessResult = {
  markdown: string;
  images: ImageRecord[];
};

const IMAGE_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;

function detectExtension(buffer: Buffer): string {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return "jpg";
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return "png";
  if (buffer[0] === 0x47 && buffer[1] === 0x49) return "gif";
  if (buffer[0] === 0x52 && buffer[1] === 0x49) return "webp";
  return "png"; // fallback
}

function resolveImageUrl(src: string, baseUrl: string): string {
  try {
    return new URL(src, baseUrl).toString();
  } catch {
    return src;
  }
}

export function createImageHandler(storage: StorageAdapter) {
  return {
    async processImages(markdown: string, baseUrl: string): Promise<ProcessResult> {
      const images: Array<{ alt: string; url: string; index: number }> = [];
      const matches = [...markdown.matchAll(IMAGE_RE)];

      if (matches.length === 0) {
        return { markdown, images: [] };
      }

      for (const match of matches) {
        images.push({ alt: match[1], url: match[2], index: match.index! });
      }

      const results = await Promise.allSettled(
        images.map(async (img) => {
          const fullUrl = resolveImageUrl(img.url, baseUrl);
          const response = await fetch(fullUrl);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const buffer = Buffer.from(await response.arrayBuffer());
          const hash = createHash("md5").update(buffer).digest("hex");
          const ext = detectExtension(buffer);
          const filename = `images/${hash}.${ext}`;
          const localPath = await storage.save(filename, buffer);
          return { originalUrl: img.url, localPath, hash } as ImageRecord;
        })
      );

      // Rewrite markdown: replace successful downloads, keep originals on failure
      let rewritten = markdown;
      const successful: ImageRecord[] = [];
      let offset = 0;

      for (let i = 0; i < images.length; i++) {
        const result = results[i];
        if (result.status === "fulfilled") {
          const record = result.value;
          const oldUrl = record.originalUrl;
          const pos = rewritten.indexOf(oldUrl, offset);
          if (pos !== -1) {
            rewritten = rewritten.slice(0, pos) + record.localPath + rewritten.slice(pos + oldUrl.length);
            offset = pos + record.localPath.length;
          }
          successful.push(record);
        }
      }

      return { markdown: rewritten, images: successful };
    }
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/server/image-handler.test.ts`
Expected: 4 PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/ingest/image-handler.ts tests/server/image-handler.test.ts
git commit -m "feat: add image handler for downloading and rewriting markdown image URLs"
```

---

### Task 5: Update URL Normalization & Ingest Pipeline

**Files:**
- Modify: `src/server/ingest/url.ts` (add `isUrl()`)
- Modify: `src/server/ingest/normalize.ts` (make URL branch async, integrate MarkItDown)
- Modify: `src/server/ingest/storage.ts` (wire new pipeline, pass originalUrl)

- [ ] **Step 1: Add `isUrl()` to url.ts**

Replace `src/server/ingest/url.ts`:

```typescript
const TRACKING_PARAMS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "gclid", "fbclid"
];

export function normalizeUrl(input: string) {
  const url = new URL(input);
  for (const param of TRACKING_PARAMS) {
    url.searchParams.delete(param);
  }
  url.hash = "";
  return url.toString();
}

export function isUrl(input: string): boolean {
  try {
    new URL(input.trim());
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Update normalize.ts with async MarkItDown integration**

Replace `src/server/ingest/normalize.ts`:

```typescript
import { parseMarkdownUpload } from "./markdown";
import { normalizeUrl, isUrl } from "./url";
import type { createMarkItDownClient } from "./markitdown-client";
import type { createImageHandler } from "./image-handler";

export type IngestSourceType = "text" | "url" | "markdown" | "voice";

export type NormalizedKnowledgeInput =
  | {
      sourceType: "text" | "voice";
      title: string | null;
      content: string;
      originalUrl: null;
    }
  | {
      sourceType: "markdown";
      title: string;
      content: string;
      originalUrl: null;
    }
  | {
      sourceType: "url";
      title: string | null;
      content: string;
      originalUrl: string;
    };

type IngestDeps = {
  markitdown: ReturnType<typeof createMarkItDownClient>;
  imageHandler: ReturnType<typeof createImageHandler>;
};

export function normalizeKnowledgeInput(input: {
  sourceType: IngestSourceType;
  content: string;
  title?: string | null;
}) {
  if (input.sourceType === "markdown") {
    const parsed = parseMarkdownUpload(input.content);
    return {
      sourceType: "markdown" as const,
      title: parsed.title,
      content: parsed.body,
      originalUrl: null
    };
  }

  if (input.sourceType === "url") {
    return {
      sourceType: "url" as const,
      title: input.title ?? null,
      content: normalizeUrl(input.content.trim()),
      originalUrl: input.content.trim()
    };
  }

  return {
    sourceType: input.sourceType,
    title: input.title ?? null,
    content: input.content.trim(),
    originalUrl: null
  };
}

export async function enrichUrlContent(
  normalized: NormalizedKnowledgeInput,
  deps: IngestDeps
): Promise<NormalizedKnowledgeInput> {
  if (normalized.sourceType !== "url") return normalized;

  const markdown = await deps.markitdown.convertUrl(normalized.originalUrl);
  if (!markdown) return normalized; // Fallback: keep URL as content

  const { markdown: withLocalImages } = await deps.imageHandler.processImages(
    markdown,
    normalized.originalUrl
  );

  return {
    ...normalized,
    content: withLocalImages
  };
}
```

- [ ] **Step 3: Update storage.ts to orchestrate the pipeline**

Replace `src/server/ingest/storage.ts`:

```typescript
import { createKnowledgeItem } from "../knowledge/repository";
import { enrichUrlContent, normalizeKnowledgeInput } from "./normalize";
import { createMarkItDownClient } from "./markitdown-client";
import { createImageHandler } from "./image-handler";
import { createLocalStorageAdapter } from "../storage/adapter";
import path from "node:path";

const MCP_URL = process.env.MARKITDOWN_MCP_URL ?? "http://127.0.0.1:3001/mcp";

const markitdown = createMarkItDownClient(MCP_URL);

const storageDir = path.resolve(process.cwd(), "public/storage");
const imageHandler = createImageHandler(
  createLocalStorageAdapter(storageDir, "/storage")
);

export async function storeKnowledgeInput(input: {
  userId: string;
  workspaceId?: string | null;
  sourceType: "text" | "url" | "markdown" | "voice";
  content: string;
  title?: string | null;
}) {
  const normalized = normalizeKnowledgeInput(input);
  const enriched = await enrichUrlContent(normalized, {
    markitdown,
    imageHandler
  });

  return createKnowledgeItem({
    userId: input.userId,
    workspaceId: input.workspaceId,
    sourceType: enriched.sourceType,
    title: enriched.title,
    content: enriched.content,
    originalUrl: enriched.originalUrl
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add src/server/ingest/url.ts src/server/ingest/normalize.ts src/server/ingest/storage.ts
git commit -m "feat: integrate MarkItDown and image handling into ingest pipeline"
```

---

### Task 6: Update Repository to Support `originalUrl`

**Files:**
- Modify: `src/server/knowledge/repository.ts`

- [ ] **Step 1: Update KnowledgeItemRecord type and all functions**

Replace `src/server/knowledge/repository.ts`:

```typescript
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { knowledgeItems } from "../db/schema";

export type KnowledgeItemRecord = {
  id: string;
  userId: string;
  workspaceId: string | null;
  sourceType: string;
  title: string | null;
  content: string;
  originalUrl: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export async function createKnowledgeItem(input: {
  userId: string;
  workspaceId?: string | null;
  sourceType: string;
  title?: string | null;
  content: string;
  originalUrl?: string | null;
}) {
  const now = new Date();
  const record: KnowledgeItemRecord = {
    id: randomUUID(),
    userId: input.userId,
    workspaceId: input.workspaceId ?? null,
    sourceType: input.sourceType,
    title: input.title ?? null,
    content: input.content,
    originalUrl: input.originalUrl ?? null,
    status: "draft",
    createdAt: now,
    updatedAt: now
  };

  const db = await getDb();
  await db.insert(knowledgeItems).values(record).run();
  return record;
}

export async function updateKnowledgeItem(
  id: string,
  userId: string,
  input: { title?: string | null; content?: string }
) {
  const db = await getDb();
  const now = new Date();
  const values: Record<string, unknown> = { updatedAt: now };

  if (input.title !== undefined) values.title = input.title;
  if (input.content !== undefined) values.content = input.content;

  await db
    .update(knowledgeItems)
    .set(values)
    .where(and(eq(knowledgeItems.id, id), eq(knowledgeItems.userId, userId)))
    .run();

  const rows = await db
    .select()
    .from(knowledgeItems)
    .where(and(eq(knowledgeItems.id, id), eq(knowledgeItems.userId, userId)))
    .all();
  return rows[0] ?? null;
}

export async function deleteKnowledgeItem(id: string, userId: string) {
  const db = await getDb();
  await db
    .delete(knowledgeItems)
    .where(and(eq(knowledgeItems.id, id), eq(knowledgeItems.userId, userId)))
    .run();
}

export async function archiveKnowledgeItem(id: string, userId: string) {
  const db = await getDb();
  const now = new Date();

  await db
    .update(knowledgeItems)
    .set({
      status: "archived",
      updatedAt: now
    })
    .where(and(eq(knowledgeItems.id, id), eq(knowledgeItems.userId, userId)))
    .run();

  const rows = await db
    .select()
    .from(knowledgeItems)
    .where(and(eq(knowledgeItems.id, id), eq(knowledgeItems.userId, userId)))
    .all();
  const row = rows[0];

  if (!row) {
    throw new Error(`Knowledge item not found: ${id}`);
  }

  return {
    id: row.id,
    userId: row.userId,
    workspaceId: row.workspaceId,
    sourceType: row.sourceType,
    title: row.title,
    content: row.content,
    originalUrl: row.originalUrl,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export async function listKnowledgeItems(
  userId: string,
  workspaceId?: string | null
) {
  const db = await getDb();
  const conditions = [eq(knowledgeItems.userId, userId)];
  if (workspaceId) {
    conditions.push(eq(knowledgeItems.workspaceId, workspaceId));
  }
  const rows = await db
    .select()
    .from(knowledgeItems)
    .where(and(...conditions))
    .all();
  return rows;
}

export async function listRecentKnowledgeItems(
  userId: string,
  limit = 5,
  workspaceId?: string | null
) {
  const db = await getDb();
  const conditions = [eq(knowledgeItems.userId, userId)];
  if (workspaceId) {
    conditions.push(eq(knowledgeItems.workspaceId, workspaceId));
  }
  const rows = await db
    .select()
    .from(knowledgeItems)
    .where(and(...conditions))
    .orderBy(desc(knowledgeItems.createdAt))
    .limit(limit)
    .all();

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    workspaceId: row.workspaceId,
    sourceType: row.sourceType,
    title: row.title,
    content: row.content,
    originalUrl: row.originalUrl,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }));
}
```

- [ ] **Step 2: Verify existing tests still pass**

Run: `npx vitest run`
Expected: All existing tests pass (training.test.ts callers get `originalUrl: null` from the updated type)

- [ ] **Step 3: Commit**

```bash
git add src/server/knowledge/repository.ts
git commit -m "feat: add originalUrl field to knowledge item repository"
```

---

### Task 7: Update API Route to Use Ingest Pipeline

**Files:**
- Modify: `src/app/api/knowledge-items/route.ts`

The API route should pass `workspaceId` through to the ingest pipeline:

- [ ] **Step 1: Update POST handler**

Replace `src/app/api/knowledge-items/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { listRecentKnowledgeItems } from "@/server/knowledge/repository";
import { storeKnowledgeInput } from "@/server/ingest/storage";

const listKnowledgeItemsSchema = z.object({
  userId: z.string().min(1),
  workspaceId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).optional()
});

const createKnowledgeItemSchema = z.object({
  userId: z.string().min(1),
  workspaceId: z.string().optional(),
  sourceType: z.enum(["text", "url", "markdown", "voice"]),
  title: z.string().nullable().optional(),
  content: z.string().min(1)
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const payload = listKnowledgeItemsSchema.parse({
    userId: url.searchParams.get("userId") ?? "",
    workspaceId: url.searchParams.get("workspaceId") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined
  });

  const knowledgeItems = await listRecentKnowledgeItems(
    payload.userId,
    payload.limit ?? 5,
    payload.workspaceId
  );

  return NextResponse.json({ knowledgeItems });
}

export async function POST(request: Request) {
  const payload = createKnowledgeItemSchema.parse(await request.json());
  const item = await storeKnowledgeInput({
    userId: payload.userId,
    workspaceId: payload.workspaceId,
    sourceType: payload.sourceType,
    title: payload.title,
    content: payload.content
  });

  return NextResponse.json({ item });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/knowledge-items/route.ts
git commit -m "feat: wire ingest pipeline into knowledge items API route"
```

---

### Task 8: Add `dev:all` Script for Concurrent Dev

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install concurrently**

```bash
npm install -D concurrently
```

- [ ] **Step 2: Add scripts to package.json**

Edit `package.json` scripts section (lines 7-15):

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint .",
  "test": "vitest run",
  "test:watch": "vitest",
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "markitdown": "npx -y markitdown-mcp-npx --http --host 127.0.0.1 --port 3001",
  "dev:all": "concurrently -n next,md \"npm run dev\" \"npm run markitdown\""
}
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add markitdown sidecar and dev:all script"
```

---

### Task 9: Integration Test — End-to-End URL Ingestion

**Files:**
- Create: `tests/server/ingest.test.ts`

- [ ] **Step 1: Write the integration test**

```typescript
import { describe, expect, it, vi, afterEach } from "vitest";
import { storeKnowledgeInput } from "@/server/ingest/storage";
import { deleteKnowledgeItem } from "@/server/knowledge/repository";

// Mock the MarkItDown client and image handler at module level
// We test the full pipeline with mocked external dependencies
describe("storeKnowledgeInput with URL", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("stores URL content with fetched markdown when MarkItDown is available", async () => {
    // Mock MarkItDown MCP responses
    globalThis.fetch = vi.fn()
      // First call: initialize
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jsonrpc: "2.0",
          id: 1,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            serverInfo: { name: "markitdown", version: "0.1.0" }
          }
        })
      })
      // Second call: initialized notification
      .mockResolvedValueOnce({ ok: true })
      // Third call: convert_to_markdown
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jsonrpc: "2.0",
          id: 2,
          result: {
            content: [{ type: "text", text: "# Fetched Title\n\nFetched body content." }]
          }
        })
      }) as unknown as typeof fetch;

    const item = await storeKnowledgeInput({
      userId: "test_user",
      sourceType: "url",
      content: "https://example.com/article"
    });

    expect(item.sourceType).toBe("url");
    expect(item.content).toBe("# Fetched Title\n\nFetched body content.");
    expect(item.originalUrl).toBe("https://example.com/article");

    // Cleanup
    await deleteKnowledgeItem(item.id, "test_user");
  });

  it("falls back to storing URL as content when MarkItDown is unreachable", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED")) as unknown as typeof fetch;

    const item = await storeKnowledgeInput({
      userId: "test_user",
      sourceType: "url",
      content: "https://example.com/article"
    });

    expect(item.sourceType).toBe("url");
    expect(item.content).toBe("https://example.com/article");
    expect(item.originalUrl).toBe("https://example.com/article");

    // Cleanup
    await deleteKnowledgeItem(item.id, "test_user");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/ingest.test.ts`
Expected: FAIL (or pass if MarkItDown is NOT running — the fallback path)

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add tests/server/ingest.test.ts
git commit -m "test: add integration tests for URL content ingestion pipeline"
```

---

### Task 10: Generate Migration + Final Verification

**Files:**
- Generate: `drizzle/0004_*.sql`

- [ ] **Step 1: Generate the drizzle migration**

```bash
npx drizzle-kit generate
```

Expected: Creates `drizzle/0004_*.sql` with `ALTER TABLE knowledge_items ADD original_url text;`

- [ ] **Step 2: Verify migration content**

Check the generated SQL file contains the expected ALTER TABLE statement.

- [ ] **Step 3: Run full test suite one final time**

```bash
npx vitest run
```

Expected: All tests pass

- [ ] **Step 4: Final commit**

```bash
git add drizzle/
git commit -m "chore: add drizzle migration for original_url column"
```

---

## Self-Review

### 1. Spec Coverage
- ✅ URL → MarkDown conversion via MarkItDown MCP: Tasks 3, 5
- ✅ Image download + local storage: Tasks 2, 4
- ✅ Image URL rewriting in MD: Task 4
- ✅ original_url preservation: Tasks 1, 5, 6
- ✅ Graceful fallback when MarkItDown unreachable: Task 3 (returns null), Task 5 (falls back to URL)
- ✅ Deployment: Task 8 (dev:all script), docker-compose noted in design doc
- ✅ Storage adapter pattern for future S3/R2 swap: Task 2

### 2. Placeholder Scan
- No TBD, TODO, or "implement later" found
- All code steps contain actual implementation code
- All test steps contain actual test code
- All commands specified with expected output

### 3. Type Consistency
- `KnowledgeItemRecord.originalUrl: string | null` — consistent across schema, repository, and normalize types
- `NormalizedKnowledgeInput` union type — all variants have `originalUrl` field
- `createKnowledgeItem()` parameter — `originalUrl?: string | null` matches caller
- `StorageAdapter` — same interface used in image-handler and adapter module
- `createMarkItDownClient().convertUrl()` — returns `string | null`, consumed in `enrichUrlContent()`
- `createImageHandler().processImages()` — returns `ProcessResult { markdown, images }`, consumed in `enrichUrlContent()`
