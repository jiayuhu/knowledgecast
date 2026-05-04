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
  if (buffer[0] === 0x52 && buffer[1] === 0x49) return "webp";
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
      const images: Array<{ alt: string; url: string; index: number }> = [];
      const matches = [...markdown.matchAll(IMAGE_RE)];

      if (matches.length === 0) {
        return { markdown, images: [] };
      }

      for (const match of matches) {
        images.push({ alt: match[1], url: match[2], index: match.index! });
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

      let rewritten = markdown;
      const successful: ImageRecord[] = [];
      let offset = 0;

      for (let i = 0; i < images.length; i++) {
        const result = results[i];
        if (result.status === "fulfilled") {
          const record = result.value;
          const oldUrl = record.originalUrl;
          const pos = rewritten.indexOf(oldUrl, offset);
          if (pos !== -1) {
            rewritten = rewritten.slice(0, pos) + record.localPath + rewritten.slice(pos + oldUrl.length);
            offset = pos + record.localPath.length;
          }
          successful.push(record);
        }
      }

      return { markdown: rewritten, images: successful };
    }
  };
}
