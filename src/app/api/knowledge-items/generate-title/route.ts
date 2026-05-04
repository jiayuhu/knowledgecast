import { NextResponse } from "next/server";
import { z } from "zod";
import { createAIProvider } from "@/server/ai/provider";

const generateTitleSchema = z.object({
  content: z.string().min(1).max(5000)
});

export async function POST(request: Request) {
  const payload = generateTitleSchema.parse(await request.json());
  const provider = createAIProvider();

  const result = await provider.generate({
    fragments: [{ id: "title-gen", content: payload.content }],
    systemPrompt: [
      "你是一个标题生成助手。为下面这段内容生成一个简短的标题。",
      "要求：10个字以内，简洁有概括性，只返回标题文本，不要引号，不要其他内容。"
    ].join(" ")
  });

  // 从 AI 返回的 outline 第一项或 title 中提取标题
  const rawTitle = result.title?.trim() || result.outline?.[0]?.trim() || "未命名素材";
  // 限制长度
  const title = rawTitle.length > 20 ? rawTitle.slice(0, 20) : rawTitle;

  return NextResponse.json({ title });
}
