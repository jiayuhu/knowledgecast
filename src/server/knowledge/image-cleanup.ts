import { countOtherRefs, deleteImageRefs, getImageRefs } from "./image-refs";
import { createLocalStorageAdapter } from "../storage/adapter";
import path from "node:path";

function extractLocalImages(content: string | null): string[] {
  if (!content) return [];
  const matches = content.match(/\/storage\/[^\s)"']+/g);
  if (!matches) return [];
  return [...new Set(matches)];
}

async function deleteFile(filepath: string) {
  const storageDir = path.resolve(process.cwd(), "public/storage");
  const adapter = createLocalStorageAdapter(storageDir, "/storage");
  const filename = filepath.replace("/storage/", "");
  try {
    await adapter.delete(filename);
  } catch { /* 文件可能已被手动删除 */ }
}

/** 删除素材后清理不再被引用的图片 */
export async function cleanupOrphanImages(
  knowledgeItemId: string,
  deletedContent: string | null
) {
  // 1. 优先用 image_refs 表精确查询
  const imagePaths = await getImageRefs(knowledgeItemId);

  if (imagePaths.length > 0) {
    for (const imagePath of imagePaths) {
      const refCount = await countOtherRefs(imagePath, knowledgeItemId);
      if (refCount === 0) await deleteFile(imagePath);
    }
    await deleteImageRefs(knowledgeItemId);
    return;
  }

  // 2. 兜底：image_refs 无记录时（历史数据），扫描内容
  const fallbackImages = extractLocalImages(deletedContent);
  if (fallbackImages.length === 0) return;

  // 合并其他所有素材的内容，检查引用
  const { getDb } = await import("../db/client");
  const { knowledgeItems } = await import("../db/schema");
  const { ne } = await import("drizzle-orm");

  const db = await getDb();
  const rows = await db
    .select({ content: knowledgeItems.content })
    .from(knowledgeItems)
    .where(ne(knowledgeItems.id, knowledgeItemId))
    .all();

  const allContent = rows.map((r) => r.content ?? "").join("\n");

  for (const imagePath of fallbackImages) {
    if (!allContent.includes(imagePath)) {
      await deleteFile(imagePath);
    }
  }
}
