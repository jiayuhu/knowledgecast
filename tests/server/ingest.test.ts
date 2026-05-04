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

  it("MarkItDown 可用时获取正文并存入 content", async () => {
    globalThis.fetch = vi.fn()
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
      .mockResolvedValueOnce({ ok: true })
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

    await deleteKnowledgeItem(item.id, "test_user");
  });

  it("MarkItDown 不可达时降级存储 URL 原文", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED")) as unknown as typeof fetch;

    const item = await storeKnowledgeInput({
      userId: "test_user",
      sourceType: "url",
      content: "https://example.com/article"
    });

    expect(item.sourceType).toBe("url");
    expect(item.content).toBe("https://example.com/article");
    expect(item.originalUrl).toBe("https://example.com/article");

    await deleteKnowledgeItem(item.id, "test_user");
  });
});
