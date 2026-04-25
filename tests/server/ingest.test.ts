import { describe, expect, it } from "vitest";
import { parseMarkdownUpload } from "@/server/ingest/markdown";

describe("parseMarkdownUpload", () => {
  it("extracts title and body from markdown", () => {
    const result = parseMarkdownUpload(`# Intro\n\nHello world`);
    expect(result.title).toBe("Intro");
    expect(result.body).toContain("Hello world");
  });
});
