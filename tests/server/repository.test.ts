import { beforeEach, describe, expect, it } from "vitest";
import {
  archiveKnowledgeItem,
  createKnowledgeItem,
  listRecentKnowledgeItems
} from "@/server/knowledge/repository";
import { createShareLink, revokeShareLink } from "@/server/share/repository";
import { getDb } from "@/server/db/client";
import { knowledgeItems, shareLinks } from "@/server/db/schema";

describe("share repository", () => {
  beforeEach(async () => {
    const db = await getDb();
    await db.delete(knowledgeItems).run();
    await db.delete(shareLinks).run();
  });

  it("revokes a share link", async () => {
    const created = await createShareLink({
      trainingPageId: "page_1",
      token: "token_1",
      expiresAt: new Date("2026-05-01T00:00:00.000Z")
    });

    const revoked = await revokeShareLink(created.id);
    expect(revoked.status).toBe("revoked");
  });

  it("lists recent knowledge items first", async () => {
    await createKnowledgeItem({
      userId: "user_1",
      sourceType: "text",
      title: "First",
      content: "First note"
    });
    await createKnowledgeItem({
      userId: "user_1",
      sourceType: "markdown",
      title: "Second",
      content: "Second note"
    });

    const recentItems = await listRecentKnowledgeItems("user_1");

    expect(recentItems).toHaveLength(2);
    expect(recentItems[0]?.title).toBe("Second");
    expect(recentItems[1]?.title).toBe("First");
  });

  it("archives a knowledge item", async () => {
    const created = await createKnowledgeItem({
      userId: "user_1",
      sourceType: "text",
      title: "First",
      content: "First note"
    });

    const archived = await archiveKnowledgeItem(created.id, "user_1");

    expect(archived.status).toBe("archived");
  });
});
