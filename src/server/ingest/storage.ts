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
  /** 是否获取 URL 正文 + 提取嵌入链接。捕获素材 = false，提取 URL = true */
  enrich?: boolean;
}) {
  const shouldEnrich = input.enrich ?? false;
  const normalized = normalizeKnowledgeInput(input);

  let finalContent = normalized.content;
  let finalTitle = normalized.title;
  let imagePaths: string[] = [];

  if (shouldEnrich && normalized.sourceType === "url") {
    const enriched = await enrichUrlContent(normalized, { markitdown, imageHandler });
    finalContent = enriched.normalized.content;
    finalTitle = enriched.normalized.title;
    imagePaths = enriched.imagePaths;
  }

  const primary = await createWithRefs({
    userId: input.userId,
    workspaceId: input.workspaceId,
    sourceType: normalized.sourceType,
    title: finalTitle,
    content: finalContent,
    originalUrl: normalized.originalUrl
  }, imagePaths);

  // 仅当 enrich 开启时，提取 text/markdown 中的嵌入 URL 并并发创建子素材
  if (shouldEnrich && (input.sourceType === "text" || input.sourceType === "markdown")) {
    const urls = extractUrls(input.content);
    await Promise.allSettled(
      urls.map(async (url) => {
        try {
          const childNormalized = normalizeKnowledgeInput({ sourceType: "url", content: url });
          const childEnriched = await enrichUrlContent(childNormalized, { markitdown, imageHandler });
          await createWithRefs({
            userId: input.userId,
            workspaceId: input.workspaceId,
            sourceType: "url",
            title: childEnriched.normalized.title,
            content: childEnriched.normalized.content,
            originalUrl: url
          }, childEnriched.imagePaths);
        } catch (e) {
          console.error("[ingest] child URL enrichment failed:", url, e);
        }
      })
    );
  }

  return primary;
}
