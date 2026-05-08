import { beforeEach, describe, expect, it } from "vitest";
import {
  createCollection,
  deleteCollection,
  listCollections,
  updateCollection
} from "@/server/collection/repository";
import { createKnowledgeItem, listOrphanedKnowledgeItems } from "@/server/knowledge/repository";
import { getDb } from "@/server/db/client";
import { areas, collections, knowledgeItems } from "@/server/db/schema";
import { DELETE, PATCH } from "@/app/api/collections/[id]/route";
import { GET, POST, PUT } from "@/app/api/collections/route";

describe("collection repository", () => {
  beforeEach(async () => {
    const db = await getDb();
    await db.delete(knowledgeItems).run();
    await db.delete(collections).run();
    await db.delete(areas).run();
  });

  it("creates and lists collections by area in sort order", async () => {
    const first = await createCollection("user_1", "First", "area_1");
    const second = await createCollection("user_1", "Second", "area_1");
    await createCollection("user_1", "Other", "area_2");

    const result = await listCollections("user_1", "area_1");

    expect(result.map((item) => item.id)).toEqual([first.id, second.id]);
    expect(result.map((item) => item.name)).toEqual(["First", "Second"]);
    expect(first.phase).toBe("capture");
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

  it("updates collection phase", async () => {
    const created = await createCollection("user_1", "Phase Test", "area_1");

    await updateCollection(created.id, { phase: "publish" });

    const [updated] = await listCollections("user_1", "area_1");
    expect(updated.phase).toBe("publish");
  });

  it("allows all valid phase values", async () => {
    const phases = ["capture", "organize", "create", "publish", "iterate"] as const;
    const created = await createCollection("user_1", "All Phases", "area_1");

    for (const phase of phases) {
      await updateCollection(created.id, { phase });
      const [updated] = await listCollections("user_1", "area_1");
      expect(updated.phase).toBe(phase);
    }
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

  it("collections API creates a default collection and uses collection response keys", async () => {
    const response = await GET(new Request("http://localhost/api/collections"));
    const body = await response.json();

    expect(body.collections).toHaveLength(1);
    expect(body.collections[0].name).toBe("默认工作集");
    expect(body.workspaces).toBeUndefined();

    const createResponse = await POST(new Request("http://localhost/api/collections", {
      method: "POST",
      body: JSON.stringify({
        userId: "demo-user",
        name: "销售培训"
      })
    }));
    const createBody = await createResponse.json();

    expect(createBody.collection.name).toBe("销售培训");
    expect(createBody.workspace).toBeUndefined();
  });

  it("collections API reorders, updates, and deletes collections", async () => {
    const first = await createCollection("user_1", "First", "area_1");
    const second = await createCollection("user_1", "Second", "area_1");

    const reorderResponse = await PUT(new Request("http://localhost/api/collections", {
      method: "PUT",
      body: JSON.stringify({ orderedIds: [second.id, first.id] })
    }));
    expect(await reorderResponse.json()).toEqual({ ok: true });

    const reordered = await listCollections("user_1", "area_1");
    expect(reordered.map((item) => item.id)).toEqual([second.id, first.id]);

    const patchResponse = await PATCH(new Request(`http://localhost/api/collections/${first.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "Updated", topic: "Onboarding", areaId: null })
    }), {
      params: Promise.resolve({ id: first.id })
    });
    expect(await patchResponse.json()).toEqual({ ok: true });

    const updated = (await listCollections("user_1")).find((item) => item.id === first.id);
    expect(updated?.name).toBe("Updated");
    expect(updated?.topic).toBe("Onboarding");

    const deleteResponse = await DELETE(new Request(`http://localhost/api/collections/${second.id}`, {
      method: "DELETE"
    }), {
      params: Promise.resolve({ id: second.id })
    });
    expect(await deleteResponse.json()).toEqual({ ok: true });

    const remaining = await listCollections("user_1");
    expect(remaining.map((item) => item.id)).toEqual([first.id]);
  });
});
