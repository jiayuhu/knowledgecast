import { describe, expect, it, afterEach } from "vitest";
import { createLocalStorageAdapter } from "@/server/storage/adapter";
import fs from "node:fs";
import path from "node:path";

const TEST_DIR = path.resolve(process.cwd(), "tests/fixtures/storage");

describe("LocalStorageAdapter", () => {
  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true });
    }
  });

  it("保存文件并返回公开路径", async () => {
    const adapter = createLocalStorageAdapter(TEST_DIR, "/storage");
    const buffer = Buffer.from("fake-image-data");
    const publicPath = await adapter.save("test.png", buffer);

    expect(publicPath).toBe("/storage/test.png");
    expect(fs.existsSync(path.join(TEST_DIR, "test.png"))).toBe(true);
  });

  it("自动创建子目录", async () => {
    const adapter = createLocalStorageAdapter(TEST_DIR, "/storage");
    await adapter.save("a/b/c.txt", Buffer.from("hello"));

    expect(fs.existsSync(path.join(TEST_DIR, "a/b/c.txt"))).toBe(true);
  });

  it("删除文件", async () => {
    const adapter = createLocalStorageAdapter(TEST_DIR, "/storage");
    await adapter.save("del.txt", Buffer.from("x"));
    await adapter.delete("del.txt");

    expect(fs.existsSync(path.join(TEST_DIR, "del.txt"))).toBe(false);
  });

  it("删除不存在的文件时抛出异常", async () => {
    const adapter = createLocalStorageAdapter(TEST_DIR, "/storage");
    await expect(adapter.delete("nonexistent.txt")).rejects.toThrow();
  });
});
