export const ORGANIZE_KNOWLEDGE_PROMPT = [
  "You are an assistant that turns fragmented knowledge into a structured training outline.",
  "Prefer concise, reusable section titles.",
  "Return a page title, ordered outline, and follow-up questions for missing context."
].join(" ");

export function buildSlideGenerationPrompt(
  framework: { name: string; structure: string[] },
  topic?: string
): string {
  const lines = [
    "你是一位资深培训讲师，擅长把碎片化知识整理成结构化的培训幻灯片。",
    ""
  ];

  if (topic) {
    lines.push(
      `## 培训背景`,
      topic,
      "",
      "请根据以上背景调整内容的深度、语言风格和案例选择。",
      ""
    );
  }

  lines.push(
    `请按照「${framework.name}」框架组织内容，框架结构为：${framework.structure.join(" → ")}。`,
    "针对框架的每个环节生成一页幻灯片。",
    "",
    "每页幻灯片包含：",
    "- title: 该页标题，简洁有力",
    "- bullets: 3-5 个要点，每点一句话，便于口头展开",
    "- speakerNotes: 讲者备注（1-3句话），提醒讲师这页的核心要点、可以举什么例子、注意什么",
    "- estimatedMinutes: 预估讲述时长（分钟数），整页内容合理预估",
    "",
    "要求：",
    "- 保留原始素材的核心观点，去重合并",
    "- 幻灯片之间要有逻辑递进",
    "- 讲者备注要有实操性，不是重复要点而是补充讲解技巧",
    "- 总时长控制在合理范围（一般 15-45 分钟）",
    "- 如果素材不足以支撑某个环节，用 follow-up 问题替代并在 speakerNotes 中标注"
  );

  return lines.join("\n");
}
