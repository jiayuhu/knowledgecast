import { createHash } from "node:crypto";
import type { StorageAdapter } from "../storage/adapter";

type ImageRecord = {
  originalUrl: string;
  localPath: string;
  hash: string;
};

type ProcessResult = {
  markdown: string;
  images: ImageRecord[];
};

const IMAGE_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;

function detectExtension(buffer: Buffer): string {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return "jpg";
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return "png";
  if (buffer[0] === 0x47 && buffer[1] === 0x49) return "gif";
  // RIFF 容器：检查 WEBP 魔术字 (bytes 8-11)
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return "webp";
  // SVG: 检查 XML 或 svg 开头
  if (buffer[0] === 0x3c) {
    const head = buffer.toString("utf-8", 0, 5).toLowerCase();
    if (head.startsWith("<svg") || head.startsWith("<?xml")) return "svg";
  }
  return "png";
}

function resolveImageUrl(src: string, baseUrl: string): string {
  try {
    return new URL(src, baseUrl).toString();
  } catch {
    return src;
  }
}

export function createImageHandler(storage: StorageAdapter) {
  return {
    async processImages(markdown: string, baseUrl: string): Promise<ProcessResult> {
      const images: Array<{ alt: string; url: string; index: number; length: number }> = [];
      const matches = [...markdown.matchAll(IMAGE_RE)];

      if (matches.length === 0) {
        return { markdown, images: [] };
      }

      for (const match of matches) {
        images.push({
          alt: match[1],
          url: match[2],
          index: match.index!,
          length: match[0].length
        });
      }

      const results = await Promise.allSettled(
        images.map(async (img) => {
          const fullUrl = resolveImageUrl(img.url, baseUrl);
          const response = await fetch(fullUrl);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const buffer = Buffer.from(await response.arrayBuffer());
          const hash = createHash("md5").update(buffer).digest("hex");
          const ext = detectExtension(buffer);
          const filename = `${hash}.${ext}`;
          const localPath = await storage.save(filename, buffer);
          return { originalUrl: img.url, localPath, hash } as ImageRecord;
        })
      );

      // 记录成功下载的记录，从右往左按位点替换避免偏移
      const replacements: Array<{ pos: number; len: number; newMd: string }> = [];
      const successful: ImageRecord[] = [];

      for (let i = 0; i < images.length; i++) {
        const result = results[i];
        if (result.status === "fulfilled") {
          const img = images[i];
          replacements.push({
            pos: img.index,
            len: img.length,
            newMd: `![${img.alt}](${result.value.localPath})`
          });
          successful.push(result.value);
        }
      }

      let rewritten = markdown;
      // 从右往左替换避免偏移漂移
      replacements.sort((a, b) => b.pos - a.pos);
      for (const r of replacements) {
        rewritten = rewritten.slice(0, r.pos) + r.newMd + rewritten.slice(r.pos + r.len);
      }

      return { markdown: rewritten, images: successful };
    }
  };
}
