import { describe, expect, it, vi } from "vitest";
import { organizeKnowledge } from "@/server/ai/organize";
import { createOpenAIProvider } from "@/server/ai/provider";

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

  it("calls the OpenAI Responses API with structured output", async () => {
    const parse = vi.fn(async () => ({
      output_parsed: {
        title: "KnowledgeCast Overview",
        outline: ["Why", "What", "How"],
        followUpQuestions: ["Who is the audience?"]
      }
    }));

    const provider = createOpenAIProvider({
      apiKey: "test-key",
      client: {
        responses: {
          parse
        }
      }
    });

    const result = await provider.generate({
      fragments: [
        { id: "1", content: "AI helps sort notes." },
        { id: "2", content: "Training pages replace PPT." }
      ],
      systemPrompt: "You are a helpful assistant."
    });

    expect(parse).toHaveBeenCalledTimes(1);
    const request = parse.mock.calls[0]?.[0];
    expect(request?.model).toBe("gpt-5.4-mini");
    expect(request?.store).toBe(false);
    expect(request?.input[0]).toEqual({
      role: "system",
      content: "You are a helpful assistant."
    });
    expect(request?.input[1].content).toContain("AI helps sort notes.");
    expect(request?.input[1].content).toContain("Training pages replace PPT.");
    expect(result).toEqual({
      title: "KnowledgeCast Overview",
      outline: ["Why", "What", "How"],
      followUpQuestions: ["Who is the audience?"]
    });
  });
});
