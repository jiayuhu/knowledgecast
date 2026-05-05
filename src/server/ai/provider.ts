import OpenAI from "openai";
import { z } from "zod";
import type { AIProvider, KnowledgeFragment, OrganizationResult, SlideGenerationInput, TrainingContent } from "./types";
import { buildSlideGenerationPrompt } from "./prompts";

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

const slideSchema = z.object({
  title: z.string().trim().min(1),
  bullets: z.array(z.string().trim().min(1)).min(1).max(5),
  speakerNotes: z.string().trim(),
  estimatedMinutes: z.number().min(1).max(15)
});

const trainingContentSchema = z.object({
  title: z.string().trim().min(1),
  totalMinutes: z.number().min(1).max(180),
  slides: z.array(slideSchema).min(1)
});

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

function parseAndValidateTrainingContent(content: string, frameworkId: string): TrainingContent {
  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    throw new Error(`AI returned invalid JSON for slides: ${content.slice(0, 200)}`);
  }

  const parsed = trainingContentSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `Slide generation failed schema validation: ${parsed.error.message}`
    );
  }

  return {
    ...parsed.data,
    framework: frameworkId
  };
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

function buildSlideUserMessage(input: SlideGenerationInput): string {
  const lines = [
    "请将以下碎片素材，按照指定的培训框架组织成幻灯片。",
    "",
    "素材内容：",
    formatFragments(input.fragments),
    ""
  ];

  if (input.instruction) {
    lines.push("用户调整要求：", input.instruction, "");
  }

  if (input.previousSlides) {
    lines.push(
      "上一版本的幻灯片（请在此基础上调整，保留用户满意的部分）：",
      JSON.stringify(input.previousSlides, null, 2),
      ""
    );
  }

  lines.push("请返回符合框架结构的幻灯片 JSON，每页包含 title、bullets、speakerNotes、estimatedMinutes。");

  return lines.join("\n");
}

export function createDeepSeekProvider(options: {
  apiKey?: string;
  client?: ChatClient;
  model?: string;
  temperature?: number;
  maxTokens?: number;
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
  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.maxTokens ?? 4096;

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
        temperature,
        max_tokens: maxTokens,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("DeepSeek returned an empty response");
      }

      return parseAndValidate(content);
    },

    async generateSlides(input) {
      const systemPrompt = buildSlideGenerationPrompt(input.framework, input.topic);
      const userMessage = buildSlideUserMessage(input);

      const response = await client.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content: [
              systemPrompt,
              "",
              "You must respond with a valid JSON object matching this structure:",
              '{ "title": "培训标题", "totalMinutes": 30, "slides": [{ "title": "页标题", "bullets": ["要点1", "要点2"], "speakerNotes": "讲者备注", "estimatedMinutes": 5 }] }'
            ].join("\n")
          },
          { role: "user", content: userMessage }
        ],
        response_format: { type: "json_object" },
        temperature,
        max_tokens: maxTokens,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("DeepSeek returned an empty response for slide generation");
      }

      return parseAndValidateTrainingContent(content, input.framework.id);
    }
  };
}

export function createOpenAIProvider(options: {
  apiKey?: string;
  client?: ChatClient;
  model?: string;
  temperature?: number;
  maxTokens?: number;
} = {}): AIProvider {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey && !options.client) {
    throw new Error("Missing required env var: OPENAI_API_KEY");
  }

  const client = options.client ?? new OpenAI({ apiKey });
  const model = options.model ?? process.env.OPENAI_MODEL ?? "gpt-5.4-mini";
  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.maxTokens ?? 4096;

  return {
    async generate({ fragments, systemPrompt }) {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: buildUserMessage(fragments) }
        ],
        response_format: { type: "json_object" },
        temperature,
        max_tokens: maxTokens,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("OpenAI returned an empty response");
      }

      return parseAndValidate(content);
    },

    async generateSlides(input) {
      const systemPrompt = buildSlideGenerationPrompt(input.framework, input.topic);
      const userMessage = buildSlideUserMessage(input);

      const response = await client.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content: [
              systemPrompt,
              "",
              "Respond with JSON: { \"title\": \"...\", \"totalMinutes\": N, \"slides\": [{ \"title\": \"...\", \"bullets\": [...], \"speakerNotes\": \"...\", \"estimatedMinutes\": N }] }"
            ].join("\n")
          },
          { role: "user", content: userMessage }
        ],
        response_format: { type: "json_object" },
        temperature,
        max_tokens: maxTokens,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("OpenAI returned an empty response for slide generation");
      }

      return parseAndValidateTrainingContent(content, input.framework.id);
    }
  };
}

export function createAIProvider(
  type?: "deepseek" | "openai",
  options?: { apiKey?: string; model?: string; temperature?: number; maxTokens?: number }
): AIProvider {
  const provider =
    type ?? (process.env.AI_PROVIDER as "deepseek" | "openai") ?? "deepseek";

  if (provider === "openai") {
    return createOpenAIProvider(options);
  }
  return createDeepSeekProvider(options);
}

export type AISettingsStatus = {
  configured: boolean;
  provider: string;
  hasApiKey: boolean;
  model: string;
  message: string;
};

export async function checkAISettings(): Promise<AISettingsStatus> {
  try {
    const { getSettings } = await import("@/server/settings/repository");
    const settings = await getSettings();
    const provider = settings.aiProvider;
    const apiKey =
      provider === "deepseek" ? settings.deepseekApiKey : settings.openaiApiKey;
    const model =
      provider === "deepseek" ? settings.deepseekModel : settings.openaiModel;

    if (!apiKey) {
      return {
        configured: false,
        provider,
        hasApiKey: false,
        model,
        message: `请在 AI 模型设置中配置 ${provider === "deepseek" ? "DeepSeek" : "OpenAI"} API Key`,
      };
    }

    return {
      configured: true,
      provider,
      hasApiKey: true,
      model,
      message: "AI 配置完整",
    };
  } catch {
    return {
      configured: false,
      provider: "unknown",
      hasApiKey: false,
      model: "",
      message: "数据库未就绪，请稍后重试",
    };
  }
}

export async function getAIProvider(): Promise<AIProvider> {
  const status = await checkAISettings();

  if (!status.configured) {
    throw new Error(status.message);
  }

  let apiKey: string | undefined;
  let model: string | undefined;
  let temperature: number | undefined;
  let maxTokens: number | undefined;

  const { getSettings } = await import("@/server/settings/repository");
  const settings = await getSettings();
  const type = settings.aiProvider as "deepseek" | "openai";

  if (type === "deepseek") {
    apiKey = settings.deepseekApiKey;
    model = settings.deepseekModel;
  } else {
    apiKey = settings.openaiApiKey;
    model = settings.openaiModel;
  }
  temperature = settings.temperature;
  maxTokens = settings.maxTokens;

  return createAIProvider(type, { apiKey, model, temperature, maxTokens });
}
