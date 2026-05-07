import { NextResponse } from "next/server";
import { z } from "zod";
import { getSettingsForClient, updateSettings } from "@/server/settings/repository";
import { checkAISettings } from "@/server/ai/provider";

const updateSchema = z.object({
  aiProvider: z.enum(["deepseek", "openai"]).optional(),
  deepseekApiKey: z.string().optional(),
  deepseekModel: z.string().optional(),
  openaiApiKey: z.string().optional(),
  openaiModel: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).max(128000).optional(),
});

function checkAdmin(request: Request): boolean {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return true;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${token}`;
}

export async function GET(request: Request) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [settings, aiStatus] = await Promise.all([
    getSettingsForClient(),
    checkAISettings(),
  ]);
  return NextResponse.json({ settings, aiStatus });
}

export async function PUT(request: Request) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const payload = updateSchema.parse(await request.json());
  await updateSettings(payload);
  const [masked, aiStatus] = await Promise.all([
    getSettingsForClient(),
    checkAISettings(),
  ]);
  return NextResponse.json({ settings: masked, aiStatus });
}
