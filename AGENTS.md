# KnowledgeCast

## Project Goal

KnowledgeCast is a small SaaS for turning fragmented knowledge into structured content and generating shareable internal training pages.

## Current MVP Scope

- 文本/链接/Markdown 碎片输入（自动识别类型）
- 5 套预设培训框架模板
- AI 按框架生成幻灯片（标题 + 要点 + 讲者备注 + 时长预估）
- AI 对话式迭代（自然语言指令调整，保留版本历史）
- 私密分享链接 + 邮箱 OTP 访问控制
- 幻灯片式培训页展示
- 水印保护 + 审计日志

## Security and Sharing Rules

- Do not expose raw HTML source downloads
- Do not add export features unless explicitly requested
- Treat copy restriction as friction, not absolute security
- Prefer server-side or controlled rendering for share pages
- Support link expiration and revocation
- Keep access logs and basic audit trails

## AI Provider

- 默认使用 DeepSeek API（`deepseek-v4-flash`），通过 `DEEPSEEK_API_KEY` 配置
- 可选切换到 OpenAI（设置 `AI_PROVIDER="openai"`，配置 `OPENAI_API_KEY` 和 `OPENAI_MODEL`）
- 两个 provider 均使用 Chat Completions API + JSON mode
- 配置文件：`.env`（参见 `.env.example`）

## 文档更新规则

完成功能后，按变更类型同步更新对应文档：

| 变更类型 | 需更新文档 |
|---------|-----------|
| 产品需求/用户故事/场景变更 | `docs/prd.md` |
| 架构/交互流程/数据模型/UI 规范变更 | `docs/superpowers/specs/2026-04-25-knowledgecast-design.md` |
| API 路由/参数/返回变更 | `docs/api.md` |
| 项目规则/技术约定变更 | `AGENTS.md` |

更新文档在 commit 之前完成。

文档索引：
- PRD: `docs/prd.md`
- 设计 Spec: `docs/superpowers/specs/2026-04-25-knowledgecast-design.md`
- API 文档: `docs/api.md`
- 架构决策记录: `docs/adr.md`

## Working Rules

- 用中文回复用户，项目文档用中文记录
- Keep changes scoped to the user's current request
- Prefer simple, shippable implementations over broad platform work
- Do not add extra product surfaces without approval
- Use snake_case for database tables and columns; keep TypeScript identifiers in camelCase/PascalCase
- Preserve existing user changes; do not revert unrelated work
- Use non-destructive git commands only

## Notes

- The repository starts empty by design
- The design spec lives at `docs/superpowers/specs/2026-04-25-knowledgecast-design.md`
- 旧的 MVP 计划在 `docs/superpowers/plans/2026-04-25-knowledgecast-mvp-plan.md`（历史文档）
- If a future decision conflicts with this file, update this file first
