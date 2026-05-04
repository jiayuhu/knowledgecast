import { describe, expect, it, vi, afterEach } from "vitest";
import { parseMarkdownUpload } from "@/server/ingest/markdown";
import { storeKnowledgeInput } from "@/server/ingest/storage";
import { deleteKnowledgeItem } from "@/server/knowledge/repository";

describe("parseMarkdownUpload", () => {
  it("从 markdown 中提取标题和正文", () => {
    const result = parseMarkdownUpload(`# Intro\n\nHello world`);
    expect(result.title).toBe("Intro");
    expect(result.body).toContain("Hello world");
  });
});

describe("storeKnowledgeInput with URL", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("enrich=true 时获取 URL 正文并透传标题", async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: "# Fetched Title\n\nFetched body content.",
          title: "Fetched Title"
        })
      }) as unknown as typeof fetch;

    const item = await storeKnowledgeInput({
      userId: "test_user",
      sourceType: "url",
      content: "https://example.com/article",
      enrich: true
    });

    expect(item.sourceType).toBe("url");
    expect(item.content).toBe("# Fetched Title\n\nFetched body content.");
    expect(item.title).toBe("Fetched Title");
    expect(item.originalUrl).toBe("https://example.com/article");

    await deleteKnowledgeItem(item.id, "test_user");
  });

  it("enrich=false 时原样存储 URL 不获取正文", async () => {
    const item = await storeKnowledgeInput({
      userId: "test_user",
      sourceType: "url",
      content: "https://example.com/article",
      enrich: false
    });

    expect(item.sourceType).toBe("url");
    expect(item.content).toBe("https://example.com/article");
    expect(item.originalUrl).toBe("https://example.com/article");

    await deleteKnowledgeItem(item.id, "test_user");
  });
});
