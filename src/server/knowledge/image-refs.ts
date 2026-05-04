import { randomUUID } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import { getDb } from "../db/client";
import { imageRefs } from "../db/schema";

/** 将图片路径关联到知识条目 */
export async function recordImageRefs(
  knowledgeItemId: string,
  imagePaths: string[]
) {
  if (imagePaths.length === 0) return;
  const db = await getDb();
  const now = Date.now();
  for (const path of imagePaths) {
    await db.insert(imageRefs).values({
      id: randomUUID(),
      knowledgeItemId,
      imagePath: path,
      createdAt: new Date(now)
    }).run();
  }
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

/** 检查某图片是否被其他素材引用 */
export async function countOtherRefs(
  imagePath: string,
  excludeItemId: string
): Promise<number> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(imageRefs)
    .where(
      and(
        eq(imageRefs.imagePath, imagePath),
        ne(imageRefs.knowledgeItemId, excludeItemId)
      )
    )
    .all();
  return rows.length;
}
