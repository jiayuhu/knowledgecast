# 架构决策记录 (ADR)

记录关键架构决策及其背景和权衡。

---

## ADR-001: 选择 DeepSeek 作为默认 AI Provider

**日期**: 2026-05-02

**决策**: 默认使用 DeepSeek API (`deepseek-v4-flash`)，OpenAI 作为可选切换。

**理由**:
- DeepSeek API 与 OpenAI SDK 完全兼容，通过 `baseURL` 即可切换
- 中文生成质量和 OpenAI 持平
- 性价比更高
- Chat Completions API（非 Responses API），兼容性好

**权衡**: DeepSeek 不支持 `json_schema` 结构化输出，仅支持 `json_object` 模式。需在 prompt 中加入 JSON 示例引导格式。

---

## ADR-002: 侧边栏树形导航替代顶栏标签

**日期**: 2026-05-03

**决策**: 采用左侧固定侧边栏（工作区 → 工作集 树形结构），替代旧的顶栏三步标签。

**理由**:
- 两层概念（工作区 / 工作集）在树形结构中最直观
- 侧边栏始终可见，切换成本低，对比顶栏下拉更符合讲师日常工作习惯
- 内容区释放宽度，用 action tabs 做页面内导航

**权衡**: 侧边栏占用 240px 水平空间。在宽屏幕（>1440px）上影响不大，窄屏需后续支持折叠。

---

## ADR-003: AI 对话式迭代替代直接编辑

**日期**: 2026-05-02

**决策**: 生成后的培训内容不提供手动编辑器，用户通过自然语言指令让 AI 重新生成。

**理由**:
- 直接编辑会破坏 AI 对内容结构的理解，后续再生成时上下文断裂
- 对话式迭代保留完整上下文（原始素材 + 上轮结果 + 调整指令），AI 可做结构性调整
- 降低前端复杂度（不需要富文本编辑器、拖拽排序等）

**权衡**: 调整一个单词也要走 AI 请求，延迟略高于直接编辑。解决方案：后续加轻量编辑（如修正错别字），重大结构调整仍走 AI。

---

## ADR-004: SQLite + Drizzle ORM + Migration

**日期**: 2026-05-03

**决策**: SQLite 作为数据库，Drizzle ORM 作为数据层，Drizzle Migration 管理 schema 变更。

**理由**:
- SQLite：零配置、零运维，MVP 单体部署的理想选择
- Drizzle ORM：TypeScript 原生类型推断，与 Next.js 配合流畅
- Drizzle Migration：从 `schema.ts` 自动生成 SQL diff，启动时增量执行，不丢数据
- 初期手写的 `SCHEMA_SQL` 被 Drizzle Migration 替代，解决每次改 schema 需删库重建的问题

**权衡**: SQLite 不支持多实例写入（后续如果需多人协作会有瓶颈）。届时可迁移到 Turso（libsql 兼容协议）。

---

## ADR-005: 工作集作为素材隔离容器

**日期**: 2026-05-03

**决策**: 所有素材和培训页归入工作集，工作集归入工作区。不做全局搜索/标签/文件夹。

**理由**:
- 产品边界：不是泛知识管理工具。标签和全局搜索是知识管理工具的特征
- 讲师心智：讲师为「即将要做的一场培训」准备素材，工作集就是那张培训
- 隔离收益：不同培训的素材互不干扰，工作区提供高层次的业务方向分类

**权衡**: 同一素材用于多场培训时需要复制。后续可通过「引用」或「克隆」支持复用。

---

## ADR-006: AI 分析在整理阶段执行，不在采集阶段

**日期**: 2026-05-04

**决策**: 采集时 AI 只做标题生成（轻量、快速），不做素材评估或提示词优化。素材覆盖评估放到整理阶段——在用户选择框架后、点击生成前展示。

**理由**:
- 采集的核心体验是「快」——讲师随时粘贴就走，不应被 AI 分析打断心流
- 整理阶段用户已进入「准备生成」模式，此时给建议是增值而非打断
- 提示词优化可在 AI 生成时自动处理：在 prompt 中要求 AI 标注素材覆盖不足的环节

**实现路径**: AI 生成幻灯片时，在 speakerNotes 中标明「此环节素材不足，建议补充：XX」。结构页在生成结果顶部加提醒条展示这些建议。

---

## ADR-007: URL 素材正文获取方案选择

**日期**: 2026-05-04

**决策**: 使用 Microsoft MarkItDown 作为 URL → Markdown 转换引擎。经 `scripts/markitdown-server.py`（轻量 HTTP 包装器）集成到 Next.js API 路由中。图片下载后本地化存储，MD5 哈希去重。

**理由**:
- MarkItDown 是微软开源工具（MIT 协议），社区活跃（108K+ stars），覆盖面广——不止网页 HTML，还包括 PDF、Word、PPT 等格式
- 直接使用系统 Python 环境安装 markitdown，轻量 HTTP 包装器（50 行）替代笨重的 MCP 协议
- Python 运行时与 Node.js 通过 HTTP 解耦，部署灵活
- HTML 提取质量优于原生 Readability 方案
- 图片内容哈希去重：同一图片出现在多个素材中只存一份

**权衡**:
- 引入 Python 运行时依赖。开发环境通过 `pip install markitdown` 安装到系统 Python；生产需在容器中预装
- URL 获取有网络延迟（5-30 秒），在 API 请求中同步执行会增加响应时间。当前 MVP 阶段可接受；后续大文件可改为异步队列
- MarkItDown 不可达时降级为存储 URL 原文，不丢数据但体验降级
- 最初尝试 npx markitdown-mcp-npx 方案，但在 Windows + Python 3.14 上遇到 onnxruntime 兼容性问题。改为直接使用系统 Python + 自写 HTTP 包装器解决

**实现**: `scripts/markitdown-server.py` HTTP 包装器 + `src/server/ingest/markitdown-client.ts` REST 客户端 + `src/server/ingest/image-handler.ts` 图片处理器 + `src/server/storage/adapter.ts` 可插拔存储适配器。生产存储方案通过实现 `StorageAdapter` 接口切换。

---

## ADR-008: 图片素材本地化存储

**日期**: 2026-05-04

**决策**: MarkItDown 转换后的 Markdown 中引用的远程图片自动下载到本地 `public/storage/`，URL 重写为本地路径。存储层通过 `StorageAdapter` 接口抽象。

**理由**:
- 远程图片可能失效、被防盗链限制、或被源站删除，本地化避免培训材料损坏
- MD5 哈希文件名天然实现去重——多篇素材引用同一图片只存一份
- `StorageAdapter` 接口让开发环境用文件系统、生产环境可切换 S3/R2 等对象存储

**权衡**: 本地化存储占用磁盘空间。培训类图片通常较小（截图、示意图），MVP 阶段可忽略。后续可加图片大小上限和超时配置。

**加固（同日）**: URL 重写从 `indexOf` 字符串搜索改为 `match.index` 位点替换（从右往左），消除同一图片多次出现但部分下载失败时的替换错位 bug。RIFF 容器检测增加 WEBP 魔术字校验（bytes 8-11），新增 SVG 支持。

---

## ADR-009: 文本素材中嵌入 URL 的自动提取

**日期**: 2026-05-04（更新于同日）

**决策**: 通过 `enrich` 标志区分两种采集模式：普通捕获（`enrich: false`）原样存储不穿透 URL；提取 URL 素材（`enrich: true`）扫描内容中所有 URL 并逐个创建独立素材。原文不保留为独立素材。

**理由**:
- 两种使用场景有本质区别——有时用户只想存原文（含链接），有时想批量获取链接正文
- `enrich` 布尔标志比新增 API 端点更简洁，前端两个按钮各传各的
- 默认 `enrich: false`，避免误操作触发耗时的网络请求

**实现**: API 的 `createKnowledgeItemSchema` 增加 `enrich: z.boolean().optional()`，`storeKnowledgeInput` 按标志决定是否调用 `enrichUrlContent` 和 `extractUrls`。

---

## ADR-010: 测试使用独立数据库

**日期**: 2026-05-04

**决策**: 测试使用独立的 SQLite 数据库文件 `dev.test.db`，与开发数据库 `dev.db` 物理隔离。

**理由**:
- 此前测试的 `beforeEach` 会执行 `db.delete(knowledgeItems).run()` 清空素材表，导致开发数据丢失
- SQLite 不支持多连接隔离，无法在同一文件上实现事务级测试数据回滚
- 独立文件是最简单可靠的隔离方案

**实现**: `tests/setup.ts` 设置 `process.env.DATABASE_URL = "file:./dev.test.db"`，`vitest.config.ts` 的 `setupFiles` 引用该文件。`dev.test.db` 已加入 `.gitignore`。

---

## ADR-011: 素材正文区使用 Markdown 渲染（2 态设计）

**日期**: 2026-05-04（更新于同日）

**决策**: 素材卡片正文仅保留 2 种显示状态——默认 Markdown 渲染（图片可见，max-h-80 可滚动）和编辑源码（textarea + 保存/取消按钮）。去除折叠预览、展开/收起、缩略图等中间态。

**理由**:
- 最初的 4 态（折叠预览 → 展开渲染 → 编辑源码 + 鼠标 hover）是逐步加功能长出来的，交互路径过长
- 用户采集素材后想看的就是完整内容 + 图片，默认渲染展示是最自然的
- 标题编辑和删除/AI 按钮保持 group-hover 出现，编辑源码入口同样 hover 显示

**权衡**: 长内容默认渲染可能撑高卡片。通过 `max-h-80 overflow-y-auto`（约 320px）限制高度，保持列表可扫描性。

**加固（同日）**: `renderMarkdown` 在 `marked.parse()` 后增加 `sanitizeHtml` 步骤，正则过滤 `href="javascript:"` 和 `href="data:"` 协议，防止 XSS。编辑和删除操作增加 API 响应状态检查 + 失败提示。

---

## ADR-012: image_refs 表精确索引图片引用

**日期**: 2026-05-04

**决策**: 新增 `image_refs` 表记录知识条目与图片路径的映射关系（`knowledge_item_id` → `image_path`）。采集时在素材创建后 `recordImageRefs(itemId, imagePaths)` 写入记录。删除时通过 `getImageRefs(id)` 获取图片列表，`countOtherRefs(path, id)` 查其他引用，无引用则删文件。`image_refs` 无记录时回退到内容扫描作为历史数据兜底。

**理由**:
- 基于内容的 `LIKE '%path%'` 查询无法走索引，每次 O(n) 全表扫描
- `image_refs` 表可建索引，O(1) 精确查询，随素材数量增长保持性能
- 后续可扩展为引用计数或链接修复等功能

**实现**: `src/server/db/schema.ts` 定义表 → `drizzle/0005_*.sql` 建表 → `src/server/knowledge/image-refs.ts` 存储函数 → `src/server/knowledge/image-cleanup.ts` 双层清理。

**加固（同日）**: `recordImageRefs` 从逐条 INSERT 改为批量 VALUES；`findOrphanImages` 一次 `GROUP BY` 查询替代 N 次单独计数；`imageRefs.knowledge_item_id` 添加 `REFERENCES knowledge_items(id) ON DELETE CASCADE` 约束；`deleteFile` adapter 提升为模块级单例复用。

---

## ADR-013: 采集过程动态进度反馈

**日期**: 2026-05-04

**决策**: 采集按钮在请求期间显示阶段性描述文本（如「正在获取页面正文…」），多 URL 提取逐条显示进度（如「正在获取 (2/5): example.com/article…」）。消息分为 info（蓝）、success（绿）、error（红）三种类型。

**理由**:
- URL 正文获取耗时 3-30 秒，无反馈用户容易误以为死机
- 逐条进度让用户知道系统在工作、还需要等多久
- 不需要服务端推送或复杂的状态机，前端按顺序执行即可提供足够反馈

**优化（同日）**: 多 URL 提取从串行改为并发（限制 3 并发），服务端子素材创建使用 `Promise.allSettled`。前端进度改为 "已完成 X/Y（N 成功，M 失败）" 格式。

---

## ADR-014: Code Review 安全加固与性能优化

**日期**: 2026-05-04

**决策**: 完成全面代码审查（28 个发现），按严重度分级修复 15 项。关键修复如下：

**安全**:
- Markdown 渲染后过滤 `javascript:` 和 `data:` 链接协议，防止 XSS
- 所有 `<` `>` 在 Markdown 解析前转义

**数据正确性**:
- DELETE API 路由 `await` 图片清理（之前 fire-and-forget）
- 编辑/删除操作检查 HTTP 响应状态，失败时 UI 显示错误提示
- 图片 URL 重写用 `match.index` 位点替代 `indexOf` 字符串搜索

**性能**:
- `image_refs` 批量 INSERT（1 次 vs N 次数据库往返）
- 孤儿图片检测用 `GROUP BY`（1 次 vs N 次查询）
- 多 URL 提取并发化（限制 3 并发）
- `deleteFile` 的 adapter 提升为模块级单例

**可观测性**:
- `storage.ts`、`markitdown-client.ts`、`image-cleanup.ts` 的关键异常路径加 `console.error` 日志

**数据库完整性**:
- `image_refs.knowledge_item_id` 添加 `REFERENCES ... ON DELETE CASCADE` 外键约束

**后续待办** (原型阶段可接受):
- 用户身份验证（当前接受任意 `userId`）
- PATCH only userId = archive 的隐式语义改为显式 `action` 字段
- 测试多文件共享数据库可能冲突，后续按文件隔离
