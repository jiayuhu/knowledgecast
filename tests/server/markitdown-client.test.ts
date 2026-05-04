import { describe, expect, it, vi, afterEach } from "vitest";
import { createMarkItDownClient } from "@/server/ingest/markitdown-client";

describe("createMarkItDownClient", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("初始化 MCP 会话并调用 convert_to_markdown", async () => {
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
        json: async () => ({})
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
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("MarkItDown 不可达时返回 null", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED")) as unknown as typeof fetch;

    const client = createMarkItDownClient("http://localhost:3001/mcp");
    const result = await client.convertUrl("https://example.com");

    expect(result).toBeNull();
  });

  it("MarkItDown 返回空内容时返回 null", async () => {
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
        json: async () => ({})
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
