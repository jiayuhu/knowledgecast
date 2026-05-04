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
        }),
        generateSlides: async () => ({
          title: "KnowledgeCast Overview",
          framework: "problem-solving",
          totalMinutes: 30,
          slides: []
        })
      }
    );

    expect(result.title).toBe("KnowledgeCast Overview");
    expect(result.outline).toEqual(["Why", "What", "How"]);
  });

  it("calls the Chat Completions API with JSON mode", async () => {
    const create = vi.fn(async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              title: "KnowledgeCast Overview",
              outline: ["Why", "What", "How"],
              followUpQuestions: ["Who is the audience?"]
            })
          }
        }
      ]
    }));

    const provider = createOpenAIProvider({
      apiKey: "test-key",
      client: {
        chat: {
          completions: {
            create
          }
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

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-5.4-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant."
          },
          expect.objectContaining({
            content: expect.stringContaining("AI helps sort notes.")
          })
        ]
      })
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining("Training pages replace PPT.")
          })
        ])
      })
    );
    expect(result).toEqual({
      title: "KnowledgeCast Overview",
      outline: ["Why", "What", "How"],
      followUpQuestions: ["Who is the audience?"]
    });
  });
});
