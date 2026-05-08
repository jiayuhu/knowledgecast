import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/server/db/client";
import { accessTokens, iterationHistory, knowledgeItems, shareLinks, trainingPages } from "@/server/db/schema";
import { createKnowledgeItem } from "@/server/knowledge/repository";
import { createTrainingPage } from "@/server/training/repository";
import * as aiProvider from "@/server/ai/provider";
import { POST as generateTrainingRoute } from "@/app/api/training-pages/generate/route";
import { POST as iterateTrainingRoute } from "@/app/api/training-pages/[id]/iterate/route";
import { PATCH as patchTrainingRoute } from "@/app/api/training-pages/[id]/route";

describe("training pages routes", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    const db = await getDb();
    await db.delete(accessTokens).run();
    await db.delete(iterationHistory).run();
    await db.delete(shareLinks).run();
    await db.delete(trainingPages).run();
    await db.delete(knowledgeItems).run();
  });

  it("generate route keeps collection ownership and uses collection-scoped materials", async () => {
    await createKnowledgeItem({
      userId: "user_1",
      collectionId: "collection_a",
      sourceType: "text",
      title: "A",
      content: "Collection A note."
    });
    await createKnowledgeItem({
      userId: "user_1",
      collectionId: "collection_b",
      sourceType: "text",
      title: "B",
      content: "Collection B note."
    });

    const generateSlides = vi.fn(async () => ({
      title: "Generated A",
      framework: "problem-solving",
      totalMinutes: 20,
      slides: []
    }));
    vi.spyOn(aiProvider, "getAIProvider").mockResolvedValue({
      generate: vi.fn(),
      generateSlides
    } as never);

    const response = await generateTrainingRoute(new Request("http://localhost/api/training-pages/generate", {
      method: "POST",
      body: JSON.stringify({
        userId: "user_1",
        collectionId: "collection_a",
        frameworkId: "problem-solving",
        knowledgeItemIds: []
      })
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.trainingPage.collectionId).toBe("collection_a");
    expect(generateSlides).toHaveBeenCalledWith(
      expect.objectContaining({
        fragments: [expect.objectContaining({ content: "Collection A note." })]
      })
    );
  });

  it("iterate route rejects cross-collection update", async () => {
    const previous = await createTrainingPage({
      userId: "user_1",
      collectionId: "collection_a",
      title: "A",
      slidesJson: JSON.stringify({
        title: "A",
        framework: "problem-solving",
        totalMinutes: 20,
        slides: []
      }),
      status: "ready"
    });
    await createKnowledgeItem({
      userId: "user_1",
      collectionId: "collection_b",
      sourceType: "text",
      title: "B",
      content: "Collection B note."
    });

    vi.spyOn(aiProvider, "getAIProvider").mockResolvedValue({
      generate: vi.fn(),
      generateSlides: vi.fn(async () => ({
        title: "Wrong",
        framework: "problem-solving",
        totalMinutes: 20,
        slides: []
      }))
    } as never);

    const response = await iterateTrainingRoute(new Request(`http://localhost/api/training-pages/${previous.id}/iterate`, {
      method: "POST",
      body: JSON.stringify({
        userId: "user_1",
        collectionId: "collection_b",
        frameworkId: "problem-solving",
        instruction: "调整",
        knowledgeItemIds: []
      })
    }), {
      params: Promise.resolve({ id: previous.id })
    });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("培训页不属于当前工作集");
  });

  it("patch route can update an older training page beyond the previous list limit", async () => {
    let oldestId: string | null = null;
    for (let i = 0; i < 120; i++) {
      const page = await createTrainingPage({
        userId: "user_1",
        collectionId: "collection_a",
        title: `page-${i}`,
        status: "ready"
      });
      if (i === 0) {
        oldestId = page.id;
      }
    }

    const response = await patchTrainingRoute(new Request(`http://localhost/api/training-pages/${oldestId}`, {
      method: "PATCH",
      body: JSON.stringify({
        userId: "user_1",
        title: "updated-old-page"
      })
    }), {
      params: Promise.resolve({ id: oldestId as string })
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.trainingPage.title).toBe("updated-old-page");
  });
});
