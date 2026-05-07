import { describe, expect, it, vi, afterEach } from "vitest";
import { createMarkItDownClient } from "@/server/ingest/markitdown-client";

describe("createMarkItDownClient", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("返回 content 和 title", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: "# Page Title\n\nClean content here.",
          title: "Page Title"
        })
      });

    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const client = createMarkItDownClient("http://localhost:3002");
    const result = await client.convertUrl("https://example.com/article");

    expect(result).toEqual({
      content: "# Page Title\n\nClean content here.",
      title: "Page Title"
    });
  });

  it("title 为 null 时也行", async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: "# No Title\n\nBody."
        })
      }) as unknown as typeof fetch;

    const client = createMarkItDownClient("http://localhost:3002");
    const result = await client.convertUrl("https://example.com");

    expect(result).toEqual({ content: "# No Title\n\nBody.", title: null });
  });

  it("MarkItDown 不可达时返回 null", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED")) as unknown as typeof fetch;

    const client = createMarkItDownClient("http://localhost:3002");
    const result = await client.convertUrl("https://example.com");

    expect(result).toBeNull();
  });

  it("返回空 content 时返回 null", async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({})
      }) as unknown as typeof fetch;

    const client = createMarkItDownClient("http://localhost:3002");
    const result = await client.convertUrl("https://example.com");

    expect(result).toBeNull();
  });
});
