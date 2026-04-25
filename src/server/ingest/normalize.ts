import { parseMarkdownUpload } from "./markdown";
import { normalizeUrl } from "./url";

export type IngestSourceType = "text" | "url" | "markdown" | "voice";

export type NormalizedKnowledgeInput =
  | {
      sourceType: "text" | "voice";
      title: string | null;
      content: string;
    }
  | {
      sourceType: "markdown";
      title: string;
      content: string;
    }
  | {
      sourceType: "url";
      title: string | null;
      content: string;
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
      content: parsed.body
    };
  }

  if (input.sourceType === "url") {
    return {
      sourceType: "url" as const,
      title: input.title ?? null,
      content: normalizeUrl(input.content.trim())
    };
  }

  return {
    sourceType: input.sourceType,
    title: input.title ?? null,
    content: input.content.trim()
  };
}
