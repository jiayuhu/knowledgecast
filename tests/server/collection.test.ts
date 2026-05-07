import { beforeEach, describe, expect, it } from "vitest";
import {
  createCollection,
  deleteCollection,
  listCollections,
  updateCollection
} from "@/server/collection/repository";
import { createKnowledgeItem, listOrphanedKnowledgeItems } from "@/server/knowledge/repository";
import { getDb } from "@/server/db/client";
import { collections, knowledgeItems } from "@/server/db/schema";

describe("collection repository", () => {
  beforeEach(async () => {
    const db = await getDb();
    await db.delete(knowledgeItems).run();
    await db.delete(collections).run();
  });

  it("creates and lists collections by area in sort order", async () => {
    const first = await createCollection("user_1", "First", "area_1");
    const second = await createCollection("user_1", "Second", "area_1");
    await createCollection("user_1", "Other", "area_2");

    const result = await listCollections("user_1", "area_1");

    expect(result.map((item) => item.id)).toEqual([first.id, second.id]);
    expect(result.map((item) => item.name)).toEqual(["First", "Second"]);
  });

  it("updates collection name, topic, and area", async () => {
    const created = await createCollection("user_1", "Draft", "area_1");

    await updateCollection(created.id, {
      name: "Published",
      topic: "Onboarding",
      areaId: "area_2"
    });

    const [updated] = await listCollections("user_1", "area_2");
    expect(updated.name).toBe("Published");
    expect(updated.topic).toBe("Onboarding");
  });

  it("deleting a collection leaves materials unassigned", async () => {
    const created = await createCollection("user_1", "Draft", "area_1");
    await createKnowledgeItem({
      userId: "user_1",
      collectionId: created.id,
      sourceType: "text",
      title: "Note",
      content: "Body"
    });

    await deleteCollection(created.id);

    const orphaned = await listOrphanedKnowledgeItems("user_1");
    expect(orphaned).toHaveLength(1);
    expect(orphaned[0]?.collectionId).toBeNull();
  });
});
