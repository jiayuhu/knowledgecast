import { describe, expect, it, vi, afterEach } from "vitest";
import { createMarkItDownClient } from "@/server/ingest/markitdown-client";

describe("createMarkItDownClient", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("调用 /convert 接口并返回 markdown 内容", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: "# Page Title\n\nClean content here."
        })
      });

    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const client = createMarkItDownClient("http://localhost:3001");
    const result = await client.convertUrl("https://example.com/article");

    expect(result).toBe("# Page Title\n\nClean content here.");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith("http://localhost:3001/convert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/article" })
    });
  });

  it("MarkItDown 不可达时返回 null", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED")) as unknown as typeof fetch;

    const client = createMarkItDownClient("http://localhost:3001");
    const result = await client.convertUrl("https://example.com");

    expect(result).toBeNull();
  });

  it("返回空 content 时返回 null", async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({})
      }) as unknown as typeof fetch;

    const client = createMarkItDownClient("http://localhost:3001");
    const result = await client.convertUrl("https://example.com");

    expect(result).toBeNull();
  });
});
