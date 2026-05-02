import OpenAI from "openai";
import { z } from "zod";
import type { AIProvider, KnowledgeFragment, OrganizationResult } from "./types";

type ChatClient = {
  chat: {
    completions: {
      create: (body: {
        model: string;
        messages: Array<{ role: string; content: string }>;
        response_format?: { type: "json_object" };
        temperature?: number;
      }) => Promise<{
        choices: Array<{ message?: { content?: string | null } | null }>;
      }>;
    };
  };
};

const organizationResultSchema = z.object({
  title: z.string().trim().min(1),
  outline: z.array(z.string().trim().min(1)).min(1),
  followUpQuestions: z.array(z.string().trim().min(1))
});

const JSON_OUTPUT_EXAMPLE = `{
  "title": "Effective Team Communication",
  "outline": [
    "1. Setting Communication Norms",
    "2. Async vs Sync Communication",
    "3. Running Effective Meetings"
  ],
  "followUpQuestions": [
    "What tools does the team currently use?",
    "Are there existing communication guidelines?"
  ]
}`;

function formatFragments(fragments: KnowledgeFragment[]) {
  return fragments
    .map(
      (fragment, index) =>
        `${index + 1}. ${fragment.id}\n${fragment.content.trim()}`
    )
    .join("\n\n");
}

function buildSystemPrompt(basePrompt: string, includeJsonExample: boolean): string {
  if (!includeJsonExample) return basePrompt;
  return [
    basePrompt,
    "",
    "You must respond with a valid JSON object matching this exact structure:",
    JSON_OUTPUT_EXAMPLE
  ].join("\n");
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

function parseAndValidate(content: string): OrganizationResult {
  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    throw new Error(`AI returned invalid JSON: ${content.slice(0, 200)}`);
  }

  const parsed = organizationResultSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `AI response failed schema validation: ${parsed.error.message}`
    );
  }

  return normalizeOrganizationResult(parsed.data);
}

function buildUserMessage(fragments: KnowledgeFragment[]): string {
  return [
    "Organize these knowledge fragments into a concise internal training page.",
    "Preserve the original meaning, deduplicate overlaps, and surface missing context as follow-up questions.",
    "Return only the structured result.",
    "",
    formatFragments(fragments)
  ].join("\n");
}

export function createDeepSeekProvider(options: {
  apiKey?: string;
  client?: ChatClient;
  model?: string;
} = {}): AIProvider {
  const apiKey = options.apiKey ?? process.env.DEEPSEEK_API_KEY;
  if (!apiKey && !options.client) {
    throw new Error("Missing required env var: DEEPSEEK_API_KEY");
  }

  const client =
    options.client ??
    new OpenAI({
      apiKey,
      baseURL: "https://api.deepseek.com"
    });

  const model = options.model ?? process.env.DEEPSEEK_MODEL ?? "deepseek-chat";

  return {
    async generate({ fragments, systemPrompt }) {
      const response = await client.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content: buildSystemPrompt(systemPrompt, true)
          },
          { role: "user", content: buildUserMessage(fragments) }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("DeepSeek returned an empty response");
      }

      return parseAndValidate(content);
    }
  };
}

export function createOpenAIProvider(options: {
  apiKey?: string;
  client?: ChatClient;
  model?: string;
} = {}): AIProvider {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey && !options.client) {
    throw new Error("Missing required env var: OPENAI_API_KEY");
  }

  const client = options.client ?? new OpenAI({ apiKey });
  const model = options.model ?? process.env.OPENAI_MODEL ?? "gpt-5.4-mini";

  return {
    async generate({ fragments, systemPrompt }) {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: buildUserMessage(fragments) }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("OpenAI returned an empty response");
      }

      return parseAndValidate(content);
    }
  };
}

export function createAIProvider(
  type?: "deepseek" | "openai"
): AIProvider {
  const provider =
    type ?? (process.env.AI_PROVIDER as "deepseek" | "openai") ?? "deepseek";

  if (provider === "openai") {
    return createOpenAIProvider();
  }
  return createDeepSeekProvider();
}
