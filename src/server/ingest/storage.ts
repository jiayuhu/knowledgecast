import { createKnowledgeItem } from "../knowledge/repository";
import { enrichUrlContent, normalizeKnowledgeInput } from "./normalize";
import { createMarkItDownClient } from "./markitdown-client";
import { createImageHandler } from "./image-handler";
import { createLocalStorageAdapter } from "../storage/adapter";
import path from "node:path";

const MCP_URL = process.env.MARKITDOWN_MCP_URL ?? "http://127.0.0.1:3001/mcp";

const markitdown = createMarkItDownClient(MCP_URL);

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

  return createKnowledgeItem({
    userId: input.userId,
    workspaceId: input.workspaceId,
    sourceType: enriched.sourceType,
    title: enriched.title,
    content: enriched.content,
    originalUrl: enriched.originalUrl
  });
}
