# KnowledgeCast

面向讲师 / 培训师 / 知识型从业者，把碎片知识快速整理成**可讲、可发、可复用**的培训网页。

核心链路：`碎片知识输入 → AI 结构化整理 → 生成培训/宣讲内容 → 以网页形式输出`

## 快速开始

```bash
npm install
cp .env.example .env            # 填入 DEEPSEEK_API_KEY
pip install 'markitdown>=0.1.0,<0.1.4'  # 一次性安装 URL 正文获取依赖
npm run dev:all                  # Next.js + MarkItDown → http://localhost:3000
```

> 如果不需要 URL 正文获取功能，可以只用 `npm run dev`（MarkItDown 不可达时自动降级）。

## 项目结构

```
src/
├── app/
│   ├── layout.tsx                    # 根布局
│   ├── page.tsx                      # 首页（跳转到工作集）
│   ├── workspace/[id]/               # 工作集路由
│   │   ├── page.tsx                  # Dashboard（卡片入口 + 培训页列表）
│   │   ├── capture/page.tsx          # 采集素材
│   │   ├── structure/page.tsx        # AI 整理生成
│   │   ├── publish/page.tsx          # 发布管理
│   │   └── settings/page.tsx         # 工作集设置
│   ├── share/[token]/page.tsx        # 学员视角
│   └── api/                          # API 路由（参见 docs/api.md）
├── components/workspace/             # UI 组件（侧边栏、采集、框架选择等）
├── server/                           # 服务层
│   ├── ai/                           # AI Provider（DeepSeek / OpenAI）
│   ├── db/                           # 数据库（Drizzle ORM + Migration）
│   ├── area/repository.ts            # 工作区 CRUD
│   ├── workspace/repository.ts       # 工作集 CRUD
│   ├── knowledge/                     # 素材 CRUD + 图片引用追踪 + 清理
│   ├── ingest/                       # 素材采集管线
│   │   ├── normalize.ts              # 规范化 + 嵌入 URL 提取
│   │   ├── storage.ts                # 管线编排（主素材 + 子素材创建）
│   │   ├── markitdown-client.ts      # MarkItDown HTTP 客户端
│   │   └── image-handler.ts          # 图片下载 + MD5 去重 + URL 重写
│   ├── storage/adapter.ts            # 可插拔存储适配器（本地文件系统/S3/R2）
│   ├── training/                     # 培训页 + 框架模板
│   └── share/                        # 分享链接 + 访问控制
├── scripts/markitdown-server.py      # MarkItDown HTTP 包装服务
└── tests/                            # Vitest 单元测试（独立 DB）
```

## 核心概念

| 概念 | 说明 |
|------|------|
| 工作区（Area） | 按业务方向划分的顶层容器 |
| 工作集（Collection） | 一次培训的素材容器，归入某个工作区 |
| 素材 | 碎片知识（文本/URL/Markdown），支持「捕获素材」（原样保存）和「提取 URL 素材」（获取正文+图片）两种模式 |
| 框架 | 培训结构模板，内置 5 套 + 用户可自定义 |
| 幻灯片 | AI 生成的最小输出单元（标题 + 要点 + 讲者备注 + 时长） |

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | Next.js 15 + React 19 + Tailwind CSS v4 |
| 数据库 | SQLite + Drizzle ORM + Drizzle Migration |
| AI | DeepSeek API（默认）/ OpenAI API（可选） |
| 内容获取 | Microsoft MarkItDown（Python sidecar，HTTP 包装） |
| Markdown 渲染 | marked（素材列表内渲染正文 + 图片） |
| 测试 | Vitest（独立测试数据库 `dev.test.db`） |
| 语言 | TypeScript |

## 数据库

Drizzle Migration 管理 schema 变更，启动时自动执行增量迁移。

```bash
# 修改 src/server/db/schema.ts 后
npm run db:generate    # 生成 migration SQL
npm run dev            # 启动时自动执行
```

## 访问控制

- 分享链接 + 邮箱验证码
- 创建者预览跳过验证（`?preview=1`）
- 访问者邮箱水印
- 链接可撤销、可过期

## 文档

| 文档 | 路径 |
|------|------|
| PRD（产品需求） | `docs/prd.md` |
| 任务页内容生产流程需求草案 | `docs/task-page-content-workflow-requirements.md` |
| 培训策划卡与内容 QA 门设计 | `docs/superpowers/specs/2026-05-08-planning-card-and-content-qa-design.md` |
| 设计 Spec | `docs/superpowers/specs/2026-04-25-knowledgecast-design.md` |
| API 文档 | `docs/api.md` |
| 架构决策记录 | `docs/adr.md` |
