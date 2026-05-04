import { createKnowledgeItem } from "../knowledge/repository";
import { enrichUrlContent, extractUrls, normalizeKnowledgeInput } from "./normalize";
import { createMarkItDownClient } from "./markitdown-client";
import { createImageHandler } from "./image-handler";
import { createLocalStorageAdapter } from "../storage/adapter";
import { recordImageRefs } from "../knowledge/image-refs";
import path from "node:path";

const MARKITDOWN_URL = process.env.MARKITDOWN_URL ?? "http://127.0.0.1:3001";

const markitdown = createMarkItDownClient(MARKITDOWN_URL);

const storageDir = path.resolve(process.cwd(), "public/storage");
const imageHandler = createImageHandler(
  createLocalStorageAdapter(storageDir, "/storage")
);

async function createWithRefs(input: {
  userId: string;
  workspaceId?: string | null;
  sourceType: string;
  title?: string | null;
  content: string;
  originalUrl?: string | null;
}, imagePaths: string[]) {
  const item = await createKnowledgeItem(input);
  if (imagePaths.length > 0) {
    await recordImageRefs(item.id, imagePaths);
  }
  return item;
}

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

  const primary = await createWithRefs({
    userId: input.userId,
    workspaceId: input.workspaceId,
    sourceType: enriched.normalized.sourceType,
    title: enriched.normalized.title,
    content: enriched.normalized.content,
    originalUrl: enriched.normalized.originalUrl
  }, enriched.imagePaths);

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

        await createWithRefs({
          userId: input.userId,
          workspaceId: input.workspaceId,
          sourceType: "url",
          title: childEnriched.normalized.title,
          content: childEnriched.normalized.content,
          originalUrl: url
        }, childEnriched.imagePaths);
      } catch {
        // 单条 URL 获取失败不影响其他
      }
    }
  }

  return primary;
}
