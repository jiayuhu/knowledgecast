import { ne } from "drizzle-orm";
import { getDb } from "../db/client";
import { knowledgeItems } from "../db/schema";
import { createLocalStorageAdapter } from "../storage/adapter";
import path from "node:path";

/** 从内容中提取所有本地图片路径（/storage/...） */
export function extractLocalImages(content: string | null): string[] {
  if (!content) return [];
  const matches = content.match(/\/storage\/[^\s)"']+/g);
  if (!matches) return [];
  return [...new Set(matches)];
}

/** 删除素材后清理不再被引用的图片 */
export async function cleanupOrphanImages(
  deletedItemId: string,
  deletedItemContent: string | null
) {
  const images = extractLocalImages(deletedItemContent);
  if (images.length === 0) return;

  const db = await getDb();

  // 一次查询取回所有其他素材的内容，避免 N 次 LIKE 全表扫描
  const rows = await db
    .select({ content: knowledgeItems.content })
    .from(knowledgeItems)
    .where(ne(knowledgeItems.id, deletedItemId))
    .all();

  // 合并所有剩余内容，快速检查引用
  const allContent = rows.map((r) => r.content ?? "").join("\n");

  const storageDir = path.resolve(process.cwd(), "public/storage");
  const adapter = createLocalStorageAdapter(storageDir, "/storage");

  for (const imagePath of images) {
    if (allContent.includes(imagePath)) continue; // 有其他引用，保留
    const filename = imagePath.replace("/storage/", "");
    try {
      await adapter.delete(filename);
    } catch {
      // 文件可能已被手动删除，忽略
    }
  }
}
