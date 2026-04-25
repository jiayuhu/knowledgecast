import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import type { AIProvider, KnowledgeFragment, OrganizationResult } from "./types";

const organizationResultSchema = z.object({
  title: z.string().trim().min(1),
  outline: z.array(z.string().trim().min(1)).min(1),
  followUpQuestions: z.array(z.string().trim().min(1))
});

type OpenAIResponsesClient = {
  responses: {
    parse: (input: {
      model: string;
      input: Array<{
        role: "system" | "user";
        content: string;
      }>;
      store: boolean;
      text: ReturnType<typeof zodTextFormat>;
    }) => Promise<{
      output_parsed: OrganizationResult | null;
    }>;
  };
};

function formatFragments(fragments: KnowledgeFragment[]) {
  return fragments
    .map(
      (fragment, index) =>
        `${index + 1}. ${fragment.id}\n${fragment.content.trim()}`
    )
    .join("\n\n");
}

function normalizeOrganizationResult(
  result: OrganizationResult
): OrganizationResult {
  return {
    title: result.title.trim(),
    outline: result.outline
      .map((item) => item.trim())
      .filter((item): item is string => item.length > 0),
    followUpQuestions: result.followUpQuestions
      .map((item) => item.trim())
      .filter((item): item is string => item.length > 0)
  };
}

export function createOpenAIProvider(options: {
  apiKey?: string;
  client?: OpenAIResponsesClient;
  model?: string;
} = {}): AIProvider {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey && !options.client) {
    throw new Error("Missing required env var: OPENAI_API_KEY");
  }

  const client = options.client ?? new OpenAI({ apiKey: apiKey as string });
  const model = options.model ?? process.env.OPENAI_MODEL ?? "gpt-5.4-mini";

  return {
    async generate({ fragments, systemPrompt }) {
      const textFormat = zodTextFormat(
        organizationResultSchema,
        "knowledge_organization"
      );
      const response = await client.responses.parse({
        model,
        store: false,
        input: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: [
              "Organize these knowledge fragments into a concise internal training page.",
              "Preserve the original meaning, deduplicate overlaps, and surface missing context as follow-up questions.",
              "Return only the structured result.",
              "",
              formatFragments(fragments)
            ].join("\n")
          }
        ],
        text: {
          ...textFormat,
          format: textFormat
        }
      });

      if (!response.output_parsed) {
        throw new Error("OpenAI response did not contain a parsed result");
      }

      return normalizeOrganizationResult(response.output_parsed);
    }
  };
}

export function createMockAIProvider(): AIProvider {
  return {
    async generate() {
      throw new Error("AI provider not configured");
    }
  };
}
