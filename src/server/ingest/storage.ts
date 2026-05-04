import { createKnowledgeItem } from "../knowledge/repository";
import { enrichUrlContent, extractUrls, normalizeKnowledgeInput } from "./normalize";
import { createMarkItDownClient } from "./markitdown-client";
import { createImageHandler } from "./image-handler";
import { createLocalStorageAdapter } from "../storage/adapter";
import path from "node:path";

const MARKITDOWN_URL = process.env.MARKITDOWN_URL ?? "http://127.0.0.1:3001";

const markitdown = createMarkItDownClient(MARKITDOWN_URL);

const storageDir = path.resolve(process.cwd(), "public/storage");
const imageHandler = createImageHandler(
  createLocalStorageAdapter(storageDir, "/storage")
);

export async function storeKnowledgeInput(input: {
  userId: string;
  workspaceId?: string | null;
  sourceType: "text" | "url" | "markdown" | "voice";
  content: string;
  title?: string | null;
}) {
  const normalized = normalizeKnowledgeInput(input);
  const enriched = await enrichUrlContent(normalized, {
    markitdown,
    imageHandler
  });

  const primary = await createKnowledgeItem({
    userId: input.userId,
    workspaceId: input.workspaceId,
    sourceType: enriched.sourceType,
    title: enriched.title,
    content: enriched.content,
    originalUrl: enriched.originalUrl
  });

  // text/markdown 素材中提取嵌入的 URL，创建子素材
  if (
    input.sourceType === "text" || input.sourceType === "markdown"
  ) {
    const urls = extractUrls(input.content);

    for (const url of urls) {
      try {
        const childNormalized = normalizeKnowledgeInput({
          sourceType: "url",
          content: url
        });

        const childEnriched = await enrichUrlContent(childNormalized, {
          markitdown,
          imageHandler
        });

        await createKnowledgeItem({
          userId: input.userId,
          workspaceId: input.workspaceId,
          sourceType: "url",
          title: childEnriched.title,
          content: childEnriched.content,
          originalUrl: url
        });
      } catch {
        // 单条 URL 获取失败不影响其他
      }
    }
  }

  return primary;
}
