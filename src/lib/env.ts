export function parseEnv(raw: Record<string, string | undefined>) {
  const databaseUrl = raw.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Missing required env var: DATABASE_URL");
  }

  return {
    DATABASE_URL: databaseUrl,
    OPENAI_API_KEY: raw.OPENAI_API_KEY ?? "",
    OPENAI_MODEL: raw.OPENAI_MODEL ?? "gpt-5.4-mini",
    SMTP_FROM: raw.SMTP_FROM ?? ""
  };
}
