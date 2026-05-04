import { randomUUID } from "node:crypto";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { imageRefs } from "../db/schema";

/** 批量将图片路径关联到知识条目 */
export async function recordImageRefs(
  knowledgeItemId: string,
  imagePaths: string[]
) {
  if (imagePaths.length === 0) return;
  const db = await getDb();
  const now = Date.now();
  await db.insert(imageRefs).values(
    imagePaths.map((path) => ({
      id: randomUUID(),
      knowledgeItemId,
      imagePath: path,
      createdAt: new Date(now)
    }))
  ).run();
}

/** 获取某素材的所有图片引用 */
export async function getImageRefs(knowledgeItemId: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db
    .select({ imagePath: imageRefs.imagePath })
    .from(imageRefs)
    .where(eq(imageRefs.knowledgeItemId, knowledgeItemId))
    .all();
  return rows.map((r) => r.imagePath);
}

/** 删除某素材的所有图片引用记录 */
export async function deleteImageRefs(knowledgeItemId: string) {
  const db = await getDb();
  await db
    .delete(imageRefs)
    .where(eq(imageRefs.knowledgeItemId, knowledgeItemId))
    .run();
}

/** 批量检查图片是否被其他素材引用，返回无引用的路径列表 */
export async function findOrphanImages(
  imagePaths: string[],
  excludeItemId: string
): Promise<string[]> {
  if (imagePaths.length === 0) return [];
  const db = await getDb();

  // 批量查询：统计每个图片路径在其他素材中的引用次数
  const rows = await db
    .select({
      imagePath: imageRefs.imagePath,
      count: sql<number>`count(*)`.mapWith(Number)
    })
    .from(imageRefs)
    .where(
      and(
        inArray(imageRefs.imagePath, imagePaths),
        ne(imageRefs.knowledgeItemId, excludeItemId)
      )
    )
    .groupBy(imageRefs.imagePath)
    .all();

  const refMap = new Map(rows.map((r) => [r.imagePath, r.count]));
  return imagePaths.filter((path) => !refMap.has(path));
}
