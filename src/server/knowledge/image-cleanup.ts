import { and, eq, ne, sql } from "drizzle-orm";
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

  for (const imagePath of images) {
    // 检查是否有其他素材引用该图片
    const refs = await db
      .select({ count: sql<number>`count(*)` })
      .from(knowledgeItems)
      .where(
        and(
          ne(knowledgeItems.id, deletedItemId),
          sql`${knowledgeItems.content} LIKE ${"%" + imagePath + "%"}`
        )
      )
      .all();

    const refCount = refs[0]?.count ?? 0;
    if (refCount > 0) continue; // 有其他引用，保留文件

    // 无其他引用，删除文件
    const filename = imagePath.replace("/storage/", "");
    const storageDir = path.resolve(process.cwd(), "public/storage");
    const adapter = createLocalStorageAdapter(storageDir, "/storage");
    try {
      await adapter.delete(filename);
    } catch {
      // 文件可能已被手动删除，忽略
    }
  }
}
