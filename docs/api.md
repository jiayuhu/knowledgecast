# KnowledgeCast API 文档

Base: `/api`

## 错误响应

所有 AI 相关接口在失败时返回统一错误格式：

```json
{ "error": "错误原因说明" }
```

HTTP 状态码 `500`。前端会展示具体的错误消息，而非笼统的"操作失败"。

---

## 工作区

### `GET /api/areas`

列出所有工作区。首次访问自动创建默认工作区。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | query | 否 | 默认 `demo-user` |

**返回** `{ areas: Area[] }`

### `POST /api/areas`

创建工作区。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | body | 是 | |
| name | body | 是 | 最大 50 字符 |

### `PUT /api/areas`

重新排序工作区。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| orderedIds | body | 是 | 排序后的 ID 数组 |

### `PATCH /api/areas/[id]`

改名。

### `DELETE /api/areas/[id]`

删除工作区。

---

## 工作集

### `GET /api/collections`

列出用户的所有工作集。首次访问自动创建默认工作集。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | query | 否 | 默认 `demo-user` |
| areaId | query | 否 | 按工作区过滤 |

**返回** `{ collections: Collection[] }`

### `POST /api/collections`

创建工作集。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | body | 是 | |
| areaId | body | 否 | 所属工作区 ID |
| name | body | 是 | 最大 50 字符 |

**返回** `{ collection: Collection }`

### `PUT /api/collections`

重新排序工作集。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| orderedIds | body | 是 | 排序后的 ID 数组 |

**返回** `{ ok: true }`

### `PATCH /api/collections/[id]`

更新工作集名称、培训主题或所属工作区。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | path | 是 | 工作集 ID |
| name | body | 否 | 最大 50 字符 |
| topic | body | 否 | 培训主题描述，可传 null |
| areaId | body | 否 | 切换到目标工作区 |

**返回** `{ ok: true }`

### `DELETE /api/collections/[id]`

删除工作集。工作集下的素材不会删除，`collectionId` 会被置空（脱离工作集），可在「未归类素材」中管理。

**返回** `{ ok: true }`

---

## 知识碎片

**KnowledgeItem 类型**:

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | UUID |
| userId | string | 所属用户 |
| collectionId | string \| null | 所属工作集 |
| sourceType | string | `text` / `url` / `markdown` / `voice` |
| title | string \| null | AI 生成或手动设置的标题 |
| content | string | 正文内容 |
| originalUrl | string \| null | 当 sourceType 为 `url` 时的原始链接 |
| status | string | `draft` / `active` / `archived` |
| createdAt | number | 创建时间戳 ms |
| updatedAt | number | 更新时间戳 ms |

> **关于 URL 素材**: 当 `sourceType` 为 `url` 时，系统通过 MarkItDown 自动获取目标页面的正文并转为 Markdown 存入 `content`，原始链接保存在 `originalUrl`。页面中的图片会下载到本地 `public/storage/` 并在 Markdown 中重写为本地路径。如果 MarkItDown 服务不可达，则降级为将 URL 字符串直接存入 `content`。

### `GET /api/knowledge-items`

列出碎片。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | query | 是 | |
| collectionId | query | 否 | 按工作集过滤 |
| orphaned | query | 否 | `true` 时列出脱离工作集的素材 |
| limit | query | 否 | 默认 5，最大 200 |

**返回** `{ knowledgeItems: KnowledgeItem[] }`

### `POST /api/knowledge-items`

捕获碎片。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | body | 是 | |
| collectionId | body | 否 | |
| sourceType | body | 是 | `text` / `url` / `markdown` / `voice` |
| title | body | 否 | |
| content | body | 是 | URL 素材传入链接地址 |
| enrich | body | 否 | 是否获取 URL 正文 + 提取嵌入链接，默认 `false` |

**模式**:
- `enrich: false`（捕获素材）：所有类型原样存储，不穿透 URL，不提取嵌入链接
- `enrich: true`（提取 URL 素材）：`url` 类型通过 MarkItDown 获取页面正文并下载图片；`text`/`markdown` 类型扫描嵌入 URL 并逐个创建子素材
- MarkItDown 不可达时降级为存储 URL 原文

**返回** `{ item: KnowledgeItem }`

### `PATCH /api/knowledge-items/[id]`

更新、归档或转移碎片。只传 `userId` 时执行归档；传其他字段时执行对应更新。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | path | 是 | |
| userId | body | 是 | |
| title | body | 否 | |
| content | body | 否 | |
| collectionId | body | 否 | 转移到目标工作集，可传 `null` 脱离 |

### `DELETE /api/knowledge-items/[id]`

删除碎片。同时通过 `image_refs` 表清理不再被其他素材引用的图片文件。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | path | 是 | |
| userId | body | 是 | |

### `POST /api/knowledge-items/generate-title`

AI 为素材内容自动生成简短标题。超长内容自动截取前 3000 字符生成。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| content | body | 是 | 素材内容，自动截断至 3000 字符 |

**返回** `{ title: string }`（20 字以内）

---

## 培训页

### `GET /api/training-pages`

列出培训页。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | query | 是 | |
| limit | query | 否 | 默认 5，最大 20 |

**返回** `{ trainingPages: TrainingPage[] }`

### `POST /api/training-pages/generate`

AI 生成培训幻灯片。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | body | 是 | |
| frameworkId | body | 是 | 框架 ID |
| knowledgeItemIds | body | 否 | 不传则用所有素材 |
| topic | body | 否 | 培训主题背景，传入 AI 上下文 |
| instruction | body | 否 | 调整指令 |
| previousPageId | body | 否 | 基于已有培训页迭代 |

**返回** `{ trainingPage, shareLink }`

### `POST /api/training-pages/[id]/iterate`

基于已有培训页迭代生成新版本。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | path | 是 | 上一个培训页 ID |
| userId | body | 是 | |
| knowledgeItemIds | body | 是 | |
| frameworkId | body | 是 | |
| instruction | body | 是 | 调整指令 |

**返回** `{ trainingPage, shareLink }`

### `GET /api/training-pages/[id]/versions`

获取培训页的版本历史列表。

**返回** `{ versions: { id: string; version: number; instruction: string; createdAt: number }[] }`

### `GET /api/training-pages/[id]/versions/[versionId]`

获取单个版本的完整快照。

**返回** `{ id: string; slidesJson: string; version: number; instruction: string; createdAt: number }`

### `PATCH /api/training-pages/[id]`

更新培训页的幻灯片内容。用于版本恢复和手动编辑保存。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | path | 是 | 培训页 ID |
| userId | body | 是 | |
| slidesJson | body | 否 | 更新后的幻灯片 JSON |
| title | body | 否 | |
| totalMinutes | body | 否 | |
| version | body | 否 | |
| restoreInstruction | body | 否 | 恢复操作时传入「恢复到 vX」，会写入版本历史 |
| preRestoreVersion | body | 否 | 恢复前的版本号，用于保存恢复前快照 |
| preRestoreSlidesJson | body | 否 | 恢复前的幻灯片 JSON，用于保存恢复前快照 |

---

## 框架

### `GET /api/frameworks`

返回内置 5 套 + 用户自定义框架。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | query | 否 | 默认 `demo-user`，自定义框架按用户隔离 |

**返回** `{ frameworks: Framework[] }`（包含 `isCustom: true` 标识自定义框架）

### `POST /api/frameworks`

创建自定义框架。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | body | 是 | |
| name | body | 是 | 最大 30 字符 |
| structure | body | 是 | 步骤字符串数组，最少 1 个，最多 10 个 |
| description | body | 否 | 适用场景描述 |

### `PATCH /api/frameworks/[id]`

编辑自定义框架。

### `DELETE /api/frameworks/[id]`

删除自定义框架。

---

## 全局设置

### `GET /api/settings`

获取应用设置和 AI 配置状态。

**返回** `{ settings: AppSettings, aiStatus: AISettingsStatus }`

### `PUT /api/settings`

更新应用设置。API Key 通过 AES-256-GCM 加密存储。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| aiProvider | body | 否 | `deepseek` / `openai` |
| deepseekApiKey | body | 否 | DeepSeek API Key，传脱敏格式时跳过 |
| deepseekModel | body | 否 | 模型名称 |
| openaiApiKey | body | 否 | OpenAI API Key，传脱敏格式时跳过 |
| openaiModel | body | 否 | 模型名称 |
| temperature | body | 否 | 0-2，默认 0.7 |
| maxTokens | body | 否 | 1-128000，默认 4096 |

**AISettingsStatus 类型**:

| 字段 | 类型 | 说明 |
|------|------|------|
| configured | boolean | AI 配置是否完整可用 |
| provider | string | 当前选择的服务商 |
| hasApiKey | boolean | 是否已配置 API Key |
| model | string | 当前模型 |
| message | string | 状态描述 |

---

## 数据类型

```typescript
type Collection = {
  id: string;
  userId: string;
  areaId: string | null;
  name: string;
  topic: string | null;
  sortOrder: number | null;
  createdAt: string;
  updatedAt: string;
};

type KnowledgeItem = {
  id: string;
  userId: string;
  collectionId: string | null;
  sourceType: "text" | "url" | "markdown" | "voice";
  title: string | null;
  content: string;
  originalUrl: string | null;
  status: "draft" | "archived";
  createdAt: string;
  updatedAt: string;
};

type TrainingPage = {
  id: string;
  userId: string;
  title: string;
  framework: string | null;
  outlineJson: string | null;
  contentJson: string | null;
  slidesJson: string | null;
  totalMinutes: number | null;
  version: number | null;
  status: "processing" | "ready";
  createdAt: string;
  updatedAt: string;
};

type ShareLink = {
  id: string;
  trainingPageId: string;
  token: string;
  status: "active" | "revoked";
  expiresAt: string;
};

type AppSettings = {
  aiProvider: "deepseek" | "openai";
  deepseekApiKey: string;
  deepseekModel: string;
  openaiApiKey: string;
  openaiModel: string;
  temperature: number;
  maxTokens: number;
};

type AISettingsStatus = {
  configured: boolean;
  provider: string;
  hasApiKey: boolean;
  model: string;
  message: string;
};
```
