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

  const result = await deps.markitdown.convertUrl(normalized.originalUrl);
  if (!result) return normalized;

  const { markdown: withLocalImages } = await deps.imageHandler.processImages(
    result.content,
    normalized.originalUrl
  );

  return {
    ...normalized,
    title: normalized.title ?? result.title ?? extractFirstHeading(result.content),
    content: withLocalImages
  };
}

/** 从 Markdown 正文中提取第一个 # 标题 */
function extractFirstHeading(markdown: string): string | null {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}
