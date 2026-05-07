export function parseEnv(raw: Record<string, string | undefined>) {
  const databaseUrl = raw.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Missing required env var: DATABASE_URL");
  }

  const provider = (raw.AI_PROVIDER ?? "deepseek") as "deepseek" | "openai";

  return {
    DATABASE_URL: databaseUrl,
    AI_PROVIDER: provider,
    DEEPSEEK_API_KEY: raw.DEEPSEEK_API_KEY ?? "",
    DEEPSEEK_MODEL: raw.DEEPSEEK_MODEL ?? "deepseek-v4-flash",
    OPENAI_API_KEY: raw.OPENAI_API_KEY ?? "",
    OPENAI_MODEL: raw.OPENAI_MODEL ?? "gpt-5.4-mini",
    SMTP_FROM: raw.SMTP_FROM ?? "",
    ADMIN_TOKEN: raw.ADMIN_TOKEN ?? "",
  };
}
