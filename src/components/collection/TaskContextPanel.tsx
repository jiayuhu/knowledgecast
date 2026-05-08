"use client";

type Props = {
  phase: string;
};

export function TaskContextPanel({ phase }: Props) {
  const hints: Record<string, { title: string; items: string[] }> = {
    capture: {
      title: "采集提示",
      items: [
        "支持粘贴文本、链接和 Markdown",
        "素材越多，AI 生成的骨架越完整",
        "建议至少 3 条素材后开始整理"
      ]
    },
    organize: {
      title: "整理提示",
      items: [
        "选择一个培训框架作为骨架模板",
        "AI 会根据选中素材生成内容骨架",
        "骨架确认后进入分段创作"
      ]
    },
    create: {
      title: "创作提示",
      items: [
        "点击左侧骨架节点选择创作目标",
        "AI 基于策划卡生成段落内容",
        "逐段完成，不必一次全部生成"
      ]
    },
    publish: {
      title: "发布提示",
      items: [
        "检查内容是否可讲、可信、可用",
        "生成分享链接供团队预览",
        "可随时回到创作阶段继续完善"
      ]
    },
    iterate: {
      title: "迭代提示",
      items: [
        "添加新材料后重新整理骨架",
        "基于反馈回到采集或创作阶段",
        "每次迭代产生新版本"
      ]
    }
  };

  const info = hints[phase] ?? hints.capture;

  return (
    <div className="px-4 py-4">
      <h3 className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-3">{info.title}</h3>
      <ul className="space-y-2">
        {info.items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-gray-500">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
