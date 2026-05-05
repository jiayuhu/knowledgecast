import { getDb } from "@/server/db/client";
import { appSettings } from "@/server/db/schema";
import { encrypt, decrypt, maskApiKey } from "@/server/crypto";

type AppSettings = {
  aiProvider: string;
  deepseekApiKey: string;
  deepseekModel: string;
  openaiApiKey: string;
  openaiModel: string;
  temperature: number;
  maxTokens: number;
};

const STRING_KEYS = new Set<keyof AppSettings>(["aiProvider", "deepseekApiKey", "deepseekModel", "openaiApiKey", "openaiModel"]);
const NUMBER_KEYS = new Set<keyof AppSettings>(["temperature", "maxTokens"]);
const ENCRYPTED_KEYS = new Set<keyof AppSettings>(["deepseekApiKey", "openaiApiKey"]);

const DEFAULTS: AppSettings = {
  aiProvider: "deepseek",
  deepseekApiKey: "",
  deepseekModel: "deepseek-v4-flash",
  openaiApiKey: "",
  openaiModel: "gpt-5.4-mini",
  temperature: 0.7,
  maxTokens: 4096,
};

function isAppSettingKey(k: string): k is keyof AppSettings {
  return STRING_KEYS.has(k as keyof AppSettings) || NUMBER_KEYS.has(k as keyof AppSettings);
}

function unmaskIfNeeded(value: string): string {
  if (value.includes("...") && value.length < 20) return "";
  return value;
}

export async function getSettings(): Promise<AppSettings> {
  const db = await getDb();
  const rows = await db.select().from(appSettings);
  const map = new Map(rows.map((r) => [r.key, r]));

  const settings = { ...DEFAULTS };

  for (const key of Object.keys(DEFAULTS)) {
    if (!isAppSettingKey(key)) continue;
    const row = map.get(key);
    if (!row?.value) continue;

    if (row.encrypted) {
      try {
        settings[key] = decrypt(row.value) as never;
      } catch {
        // keep default
      }
    } else if (NUMBER_KEYS.has(key)) {
      settings[key] = Number(row.value) as never;
    } else {
      settings[key] = row.value as never;
    }
  }

  return settings;
}

export async function getSettingsForClient(): Promise<Record<string, unknown>> {
  const settings = await getSettings();
  return {
    aiProvider: settings.aiProvider,
    deepseekApiKey: settings.deepseekApiKey ? maskApiKey(settings.deepseekApiKey) : "",
    deepseekModel: settings.deepseekModel,
    openaiApiKey: settings.openaiApiKey ? maskApiKey(settings.openaiApiKey) : "",
    openaiModel: settings.openaiModel,
    temperature: settings.temperature,
    maxTokens: settings.maxTokens,
  };
}

export async function updateSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
  const db = await getDb();
  const current = await getSettings();
  const now = new Date();

  for (const key of Object.keys(updates)) {
    if (!isAppSettingKey(key)) continue;
    const value = updates[key];
    if (value === undefined) continue;

    let finalValue: string;
    let encrypted = false;

    if (ENCRYPTED_KEYS.has(key)) {
      const cleaned = unmaskIfNeeded(String(value));
      if (!cleaned) continue;
      finalValue = encrypt(cleaned);
      encrypted = true;
      current[key] = cleaned as never;
    } else if (NUMBER_KEYS.has(key)) {
      finalValue = String(value);
      current[key] = Number(value) as never;
    } else {
      finalValue = String(value);
      current[key] = finalValue as never;
    }

    await db
      .insert(appSettings)
      .values({ key, value: finalValue, encrypted, updatedAt: now })
      .onConflictDoUpdate({ target: appSettings.key, set: { value: finalValue, encrypted, updatedAt: now } });
  }

  return current;
}
