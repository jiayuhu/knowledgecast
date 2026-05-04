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

  it("下载图片并重写 Markdown 中的 URL", async () => {
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

  it("图片下载失败时保留原始 URL", async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 404 }) as unknown as typeof fetch;

    const handler = createImageHandler(mockAdapter());
    const markdown = "![broken](https://example.com/missing.png)";

    const result = await handler.processImages(markdown, "https://example.com");

    expect(result.markdown).toBe(markdown);
    expect(result.images).toHaveLength(0);
  });

  it("解析相对路径图片 URL", async () => {
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

    const capturedUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(capturedUrl).toBe("https://example.com/page/img/relative.png");
  });

  it("没有图片时返回原 Markdown", async () => {
    const handler = createImageHandler(mockAdapter());
    const markdown = "# Just text\n\nNo images here.";

    const result = await handler.processImages(markdown, "https://example.com");

    expect(result.markdown).toBe(markdown);
    expect(result.images).toHaveLength(0);
  });
});
