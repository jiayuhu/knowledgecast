# KnowledgeCast API 文档

Base: `/api`

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

### `GET /api/workspaces`

列出用户的所有工作集。首次访问自动创建默认工作集。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | query | 否 | 默认 `demo-user` |

**返回** `{ workspaces: Workspace[] }`

### `POST /api/workspaces`

创建工作集。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | body | 是 | |
| areaId | body | 否 | 所属工作区 ID |
| name | body | 是 | 最大 50 字符 |

**返回** `{ workspace: Workspace }`

### `PUT /api/workspaces`

重新排序工作集。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| orderedIds | body | 是 | 排序后的 ID 数组 |

### `PATCH /api/workspaces/[id]`

更新工作集名称、培训主题或所属工作区。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | path | 是 | 工作集 ID |
| name | body | 否 | 最大 50 字符 |
| topic | body | 否 | 培训主题描述，可传 null |
| areaId | body | 否 | 切换到目标工作区 |

### `DELETE /api/workspaces/[id]`

删除工作集。

---

## 知识碎片

**KnowledgeItem 类型**:

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | UUID |
| userId | string | 所属用户 |
| workspaceId | string \| null | 所属工作集 |
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
| workspaceId | query | 否 | 按工作集过滤 |
| limit | query | 否 | 默认 5，最大 200 |

**返回** `{ knowledgeItems: KnowledgeItem[] }`

### `POST /api/knowledge-items`

捕获碎片。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | body | 是 | |
| workspaceId | body | 否 | |
| sourceType | body | 是 | `text` / `url` / `markdown` / `voice` |
| title | body | 否 | |
| content | body | 是 | URL 素材传入链接地址 |

**行为**: `url` 类型会同步获取页面正文（耗时 3-30 秒），其他类型直接存储。

**返回** `{ item: KnowledgeItem }`

### `PATCH /api/knowledge-items/[id]`

更新或归档碎片。只传 `userId` 时执行归档；传 `title` 或 `content` 时执行更新。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | path | 是 | |
| userId | body | 是 | |
| title | body | 否 | |
| content | body | 否 | |

### `DELETE /api/knowledge-items/[id]`

删除碎片。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | path | 是 | |
| userId | body | 是 | |

### `POST /api/knowledge-items/generate-title`

AI 为素材内容自动生成简短标题。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| content | body | 是 | 素材内容，最大 5000 字符 |

**返回** `{ title: string }`（10 字以内）

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

## 数据类型

```typescript
type Workspace = {
  id: string;
  userId: string;
  name: string;
  topic: string | null;
  createdAt: string;
  updatedAt: string;
};

type KnowledgeItem = {
  id: string;
  userId: string;
  workspaceId: string | null;
  sourceType: "text" | "url" | "markdown" | "voice";
  title: string | null;
  content: string;
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
```
