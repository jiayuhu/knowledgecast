import { describe, expect, it } from "vitest";
import { organizeKnowledge } from "@/server/ai/organize";

describe("organizeKnowledge", () => {
  it("returns a structured outline from grouped fragments", async () => {
    const result = await organizeKnowledge(
      [
        { id: "1", content: "AI helps sort notes." },
        { id: "2", content: "Training pages replace PPT." }
      ],
      {
        generate: async () => ({
          title: "KnowledgeCast Overview",
          outline: ["Why", "What", "How"],
          followUpQuestions: ["Who is the audience?"]
        })
      }
    );

    expect(result.title).toBe("KnowledgeCast Overview");
    expect(result.outline).toEqual(["Why", "What", "How"]);
  });
});
