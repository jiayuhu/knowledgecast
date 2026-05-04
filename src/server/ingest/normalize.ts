import { parseMarkdownUpload } from "./markdown";
import { normalizeUrl } from "./url";
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

/** 从文本中提取所有 HTTP(S) URL，去重 */
export function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s)>"']+/g);
  if (!matches) return [];
  return [...new Set(matches)];
}

export async function enrichUrlContent(
  normalized: NormalizedKnowledgeInput,
  deps: IngestDeps
): Promise<NormalizedKnowledgeInput> {
  if (normalized.sourceType !== "url") return normalized;

  const markdown = await deps.markitdown.convertUrl(normalized.originalUrl);
  if (!markdown) return normalized;

  const { markdown: withLocalImages } = await deps.imageHandler.processImages(
    markdown,
    normalized.originalUrl
  );

  return {
    ...normalized,
    content: withLocalImages
  };
}
