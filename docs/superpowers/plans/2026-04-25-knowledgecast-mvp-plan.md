# KnowledgeCast MVP Implementation Plan

> **状态：历史文档。** 此计划对应 v0.1 MVP（单 dashboard 页面 + outline/content 输出模式）。当前架构已重构，参见 `docs/superpowers/specs/2026-04-25-knowledgecast-design.md`。

**Goal:** Build the first shippable KnowledgeCast web MVP: users can capture fragmented knowledge, have it organized by AI, generate a private internal training page, and share it through an access-controlled link.

**Architecture:** Start with a single web app rather than splitting services early. Use a Next.js App Router frontend, a Drizzle-backed SQLite database layer, and small server-side service modules for ingestion, AI orchestration, sharing, and access control. Keep rendering and permission checks on the server so share pages do not expose raw HTML downloads. Keep database identifiers in `snake_case` while TypeScript stays in `camelCase` / `PascalCase`.

**Tech Stack:** Next.js 15, TypeScript, React, Drizzle ORM, SQLite, Tailwind CSS, Zod, Vitest, and a simple email OTP transport abstraction for local and production mail delivery.

---

### Task 1: Bootstrap the app shell and config

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `eslint.config.mjs`
- Create: `postcss.config.mjs`
- Create: `tailwind.config.ts`
- Create: `vitest.config.ts`
- Create: `drizzle.config.ts`
- Create: `.env.example`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/styles/globals.css`
- Create: `src/lib/env.ts`
- Create: `tests/lib/env.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";

describe("parseEnv", () => {
  it("rejects missing DATABASE_URL", () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/env.test.ts -v`
Expected: FAIL because `parseEnv` is not implemented yet.

- [ ] **Step 3: Write the minimal implementation**

```ts
export function parseEnv(raw: Record<string, string | undefined>) {
  const databaseUrl = raw.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Missing required env var: DATABASE_URL");
  }

  return {
    DATABASE_URL: databaseUrl,
    OPENAI_API_KEY: raw.OPENAI_API_KEY ?? "",
    SMTP_FROM: raw.SMTP_FROM ?? "",
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/lib/env.test.ts -v`
Expected: PASS. `.env.example` should use `DATABASE_URL="file:./dev.db"`.

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json next.config.ts eslint.config.mjs postcss.config.mjs tailwind.config.ts vitest.config.ts drizzle.config.ts .env.example src/app/layout.tsx src/app/page.tsx src/styles/globals.css src/lib/env.ts tests/lib/env.test.ts
git commit -m "feat: bootstrap KnowledgeCast app shell"
```

### Task 2: Add persistence and core data model

**Files:**
- Create: `src/server/db/client.ts`
- Create: `src/server/db/schema.ts`
- Create: `src/server/knowledge/repository.ts`
- Create: `src/server/share/repository.ts`
- Create: `tests/server/repository.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { createShareLink, revokeShareLink } from "@/server/share/repository";

describe("share repository", () => {
  it("revokes a share link", async () => {
    const created = await createShareLink({
      trainingPageId: "page_1",
      token: "token_1",
      expiresAt: new Date("2026-05-01T00:00:00.000Z"),
    });

    const revoked = await revokeShareLink(created.id);
    expect(revoked.status).toBe("revoked");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/server/repository.test.ts -v`
Expected: FAIL because repository functions and schema are not implemented yet.

- [ ] **Step 3: Write the minimal implementation**

Implement the Drizzle schema with these core tables and a snake_case naming rule:

```ts
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const knowledgeItems = sqliteTable("knowledge_items", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  sourceType: text("source_type").notNull(),
  title: text("title"),
  content: text("content").notNull(),
  status: text("status").notNull().default("draft"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const trainingPages = sqliteTable("training_pages", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  outlineJson: text("outline_json").notNull(),
  contentJson: text("content_json").notNull(),
  status: text("status").notNull().default("ready"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const shareLinks = sqliteTable("share_links", {
  id: text("id").primaryKey(),
  trainingPageId: text("training_page_id").notNull(),
  token: text("token").notNull().unique(),
  status: text("status").notNull().default("active"),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});
```

Add repository functions that create a share link and flip `status` to `revoked`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/server/repository.test.ts -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/db/client.ts src/server/db/schema.ts src/server/knowledge/repository.ts src/server/share/repository.ts tests/server/repository.test.ts
git commit -m "feat: add KnowledgeCast persistence layer"
```

### Task 3: Implement ingestion for text, links, and Markdown

**Files:**
- Create: `app/api/knowledge-items/route.ts`
- Create: `src/server/ingest/normalize.ts`
- Create: `src/server/ingest/markdown.ts`
- Create: `src/server/ingest/url.ts`
- Create: `src/server/ingest/storage.ts`
- Create: `tests/server/ingest.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { parseMarkdownUpload } from "@/server/ingest/markdown";

describe("parseMarkdownUpload", () => {
  it("extracts title and body from markdown", () => {
    const result = parseMarkdownUpload(`# Intro\n\nHello world`);
    expect(result.title).toBe("Intro");
    expect(result.body).toContain("Hello world");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/server/ingest.test.ts -v`
Expected: FAIL because the ingest parser is missing.

- [ ] **Step 3: Write the minimal implementation**

Implement normalization helpers that:

- Trim text input.
- Extract a title from the first Markdown heading.
- Normalize URLs by stripping tracking fragments.
- Store input records as `KnowledgeItem` rows with `sourceType` set to `text`, `url`, `markdown`, or `voice`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/server/ingest.test.ts -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/knowledge-items/route.ts src/server/ingest/normalize.ts src/server/ingest/markdown.ts src/server/ingest/url.ts src/server/ingest/storage.ts tests/server/ingest.test.ts
git commit -m "feat: add knowledge ingestion flow"
```

### Task 4: Add AI organization and outline generation

**Files:**
- Create: `src/server/ai/types.ts`
- Create: `src/server/ai/provider.ts`
- Create: `src/server/ai/prompts.ts`
- Create: `src/server/ai/organize.ts`
- Create: `tests/server/ai.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { organizeKnowledge } from "@/server/ai/organize";

describe("organizeKnowledge", () => {
  it("returns a structured outline from grouped fragments", async () => {
    const result = await organizeKnowledge(
      [
        { id: "1", content: "AI helps sort notes." },
        { id: "2", content: "Training pages replace PPT." },
      ],
      {
        generate: async () => ({
          title: "KnowledgeCast Overview",
          outline: ["Why", "What", "How"],
          followUpQuestions: ["Who is the audience?"],
        }),
      }
    );

    expect(result.title).toBe("KnowledgeCast Overview");
    expect(result.outline).toEqual(["Why", "What", "How"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/server/ai.test.ts -v`
Expected: FAIL because the organizer and provider adapter are not implemented yet.

- [ ] **Step 3: Write the minimal implementation**

Implement an AI adapter interface that accepts fragments and returns:

- a page title
- an ordered outline
- follow-up questions for missing context
- a stable content JSON object for the training page

Keep prompt text in `src/server/ai/prompts.ts` so it can be tuned without changing orchestration logic.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/server/ai.test.ts -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/ai/types.ts src/server/ai/provider.ts src/server/ai/prompts.ts src/server/ai/organize.ts tests/server/ai.test.ts
git commit -m "feat: add AI organization pipeline"
```

### Task 5: Generate training pages and add private access control

**Files:**
- Create: `app/share/[token]/page.tsx`
- Create: `app/share/[token]/actions.ts`
- Create: `src/server/share/access.ts`
- Create: `src/server/share/otp.ts`
- Create: `src/components/share/AccessGate.tsx`
- Create: `src/components/share/Watermark.tsx`
- Create: `tests/server/access.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { validateOtp } from "@/server/share/otp";

describe("validateOtp", () => {
  it("rejects expired OTP codes", () => {
    const result = validateOtp({
      code: "123456",
      issuedAt: new Date("2026-04-01T00:00:00.000Z"),
      now: new Date("2026-04-01T00:11:00.000Z"),
    });

    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/server/access.test.ts -v`
Expected: FAIL because OTP validation and share access logic are not implemented yet.

- [ ] **Step 3: Write the minimal implementation**

Implement:

- private share link lookup by token
- email OTP issuance and validation
- short-lived access grants
- watermark rendering with the viewer email or access marker
- server-side page rendering for the training content

Do not add a raw HTML download path.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/server/access.test.ts -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/share/[token]/page.tsx app/share/[token]/actions.ts src/server/share/access.ts src/server/share/otp.ts src/components/share/AccessGate.tsx src/components/share/Watermark.tsx tests/server/access.test.ts
git commit -m "feat: add private share access flow"
```

### Task 6: Harden the MVP and document the workflow

**Files:**
- Create: `middleware.ts`
- Create: `src/server/rate-limit.ts`
- Create: `src/server/audit.ts`
- Create: `tests/server/rate-limit.test.ts`
- Modify: `README.md`
- Modify: `AGENTS.md` only if the working rules change

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { shouldAllowRequest } from "@/server/rate-limit";

describe("shouldAllowRequest", () => {
  it("blocks repeated access bursts", () => {
    const result = shouldAllowRequest({
      key: "share:token_1",
      now: Date.now(),
      history: [1, 2, 3, 4, 5],
      limit: 5,
    });

    expect(result.allowed).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/server/rate-limit.test.ts -v`
Expected: FAIL because rate limiting and audit helpers are not implemented yet.

- [ ] **Step 3: Write the minimal implementation**

Implement:

- simple request rate limiting keyed by share token and email
- audit event recording for share creation, OTP verification, access grant, and revoke
- middleware guard for protected share routes
- README notes for local setup and the privacy model

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/server/rate-limit.test.ts -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add middleware.ts src/server/rate-limit.ts src/server/audit.ts README.md
git commit -m "feat: harden KnowledgeCast MVP"
```

## Self-Review Checklist

- Spec coverage: the plan covers capture, persistence, AI organization, page generation, private sharing, and basic hardening.
- Placeholder scan: no TBD/TODO/fill-in sections remain in the plan body.
- Type consistency: repository, AI, ingest, access, and rate-limit names are reused consistently across tasks.
- Scope check: the plan stays inside the MVP boundary and does not add collaboration, PDF export, or complex document editing.
