import { countOtherRefs, deleteImageRefs, getImageRefs } from "./image-refs";
import { createLocalStorageAdapter } from "../storage/adapter";
import path from "node:path";

/** 删除素材后清理不再被引用的图片 */
export async function cleanupOrphanImages(knowledgeItemId: string) {
  const images = await getImageRefs(knowledgeItemId);
  if (images.length === 0) return;

  const storageDir = path.resolve(process.cwd(), "public/storage");
  const adapter = createLocalStorageAdapter(storageDir, "/storage");

  for (const imagePath of images) {
    const refCount = await countOtherRefs(imagePath, knowledgeItemId);
    if (refCount > 0) continue; // 有其他引用，保留文件

    const filename = imagePath.replace("/storage/", "");
    try {
      await adapter.delete(filename);
    } catch {
      // 文件可能已被手动删除，忽略
    }
  }

  // 删除该素材的所有引用记录
  await deleteImageRefs(knowledgeItemId);
}
