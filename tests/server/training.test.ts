import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/server/db/client";
import {
  accessTokens,
  knowledgeItems,
  shareLinks,
  trainingPages
} from "@/server/db/schema";
import { createKnowledgeItem } from "@/server/knowledge/repository";
import { listRecentTrainingPages } from "@/server/training/repository";
import { generateTrainingPage } from "@/server/training/service";

describe("generateTrainingPage", () => {
  beforeEach(async () => {
    const db = await getDb();
    await db.delete(accessTokens).run();
    await db.delete(shareLinks).run();
    await db.delete(trainingPages).run();
    await db.delete(knowledgeItems).run();
  });

  it("organizes fragments into a ready training page and share link", async () => {
    await createKnowledgeItem({
      userId: "user_1",
      sourceType: "text",
      title: "Intro",
      content: "AI helps sort notes."
    });
    await createKnowledgeItem({
      userId: "user_1",
      sourceType: "markdown",
      title: "Training",
      content: "Training pages replace PPT."
    });

    const provider = {
      generate: vi.fn(async () => ({
        title: "KnowledgeCast Overview",
        outline: ["Why", "What", "How"],
        followUpQuestions: ["Who is the audience?"]
      })),
      generateSlides: vi.fn(async () => ({
        title: "KnowledgeCast Overview",
        framework: "problem-solving",
        totalMinutes: 30,
        slides: []
      }))
    };

    const result = await generateTrainingPage(
      {
        userId: "user_1",
        knowledgeItemIds: []
      },
      provider
    );

    expect(provider.generate).toHaveBeenCalledTimes(1);
    expect(result.trainingPage.status).toBe("ready");
    expect(result.trainingPage.title).toBe("KnowledgeCast Overview");
    expect(result.trainingPage.outline).toEqual(["Why", "What", "How"]);
    expect(result.trainingPage.content.join("\n")).toContain(
      "Training focus: KnowledgeCast Overview"
    );
    expect(result.shareLink.status).toBe("active");
    expect(result.shareLink.token).toHaveLength(36);
  });

  it("lists recent training pages with their share links", async () => {
    await createKnowledgeItem({
      userId: "user_1",
      sourceType: "text",
      title: "Intro",
      content: "AI helps sort notes."
    });

    const provider = {
      generate: vi.fn(async () => ({
        title: "KnowledgeCast Overview",
        outline: ["Why", "What", "How"],
        followUpQuestions: ["Who is the audience?"]
      })),
      generateSlides: vi.fn(async () => ({
        title: "KnowledgeCast Overview",
        framework: "problem-solving",
        totalMinutes: 30,
        slides: []
      }))
    };

    const generated = await generateTrainingPage(
      {
        userId: "user_1",
        knowledgeItemIds: []
      },
      provider
    );

    const recentPages = await listRecentTrainingPages("user_1");

    expect(recentPages).toHaveLength(1);
    expect(recentPages[0]?.title).toBe("KnowledgeCast Overview");
    expect(recentPages[0]?.shareLink?.token).toBe(generated.shareLink.token);
  });
});
