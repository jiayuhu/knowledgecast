import fs from "node:fs/promises";
import path from "node:path";

export interface StorageAdapter {
  /** 保存文件，返回公开 URL 路径 */
  save(filename: string, buffer: Buffer): Promise<string>;
  /** 按文件名删除文件 */
  delete(filename: string): Promise<void>;
}

export function createLocalStorageAdapter(
  baseDir: string,
  publicPrefix: string
): StorageAdapter {
  return {
    async save(filename: string, buffer: Buffer): Promise<string> {
      const fullPath = path.join(baseDir, filename);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, buffer);
      return `${publicPrefix}/${filename}`;
    },

    async delete(filename: string): Promise<void> {
      const fullPath = path.join(baseDir, filename);
      await fs.unlink(fullPath);
    }
  };
}
