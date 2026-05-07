# KnowledgeCast Collection 概念迁移设计

## 1. 结论

将当前“工作集”对应的数据、API 和前端 URL 统一迁移为 `collection` 概念：

- 数据表从 `workspaces` 改为 `collections`
- 素材归属字段从 `workspace_id` 改为 `collection_id`
- API 从 `/api/workspaces` 改为 `/api/collections`
- 后台编辑 URL 从 `/workspace/[id]` 改为 `/collections/[id]`
- Sidebar 中的“工作集”点击后进入对应 collection URL

这次迁移的目标是消除三套概念并存的问题：数据库叫 `workspaces`，UI 叫“工作集”，URL 叫 `/workspace/[id]`。迁移后，系统内部统一使用 `collection`，中文 UI 仍显示“工作集”。

## 2. 概念边界

### 2.1 Area

`area` 继续表示 Sidebar 顶层分组，中文 UI 仍为“工作区”。

保留：

- 表：`areas`
- API：`/api/areas`
- UI 文案：“工作区”

### 2.2 Collection

`collection` 表示一个工作集，是知识素材的归属容器，也是生成培训页的上下文边界。

迁移后：

- 表：`collections`
- API：`/api/collections`
- URL：`/collections/[id]`
- UI 文案：“工作集”
- TypeScript 类型：`Collection`

### 2.3 Unassigned

未归类素材不是一个 collection，不应挂在某个 collection ID 下。

迁移后：

- URL：`/unassigned`
- UI 文案：“未归类素材”
- 不保留旧 URL `/workspace/orphaned`

## 3. 数据模型

### 3.1 表迁移

`workspaces` 重命名为 `collections`，字段保持业务含义不变：

| 旧字段 | 新字段 | 说明 |
|--------|--------|------|
| `id` | `id` | 主键不变 |
| `user_id` | `user_id` | 所属用户不变 |
| `area_id` | `area_id` | 所属工作区不变 |
| `name` | `name` | 工作集名称不变 |
| `topic` | `topic` | 主题不变 |
| `sort_order` | `sort_order` | 排序不变 |
| `created_at` | `created_at` | 创建时间不变 |
| `updated_at` | `updated_at` | 更新时间不变 |

### 3.2 素材归属字段

`knowledge_items.workspace_id` 重命名为 `knowledge_items.collection_id`。

现有值原样迁移，继续指向对应 collection 的 `id`。未归类素材保持 `collection_id = null`。

### 3.3 Drizzle Schema

`src/server/db/schema.ts` 中导出：

- `collections = sqliteTable("collections", ...)`
- `knowledgeItems.collectionId = text("collection_id")`

不再导出 `workspaces` 表对象。业务层不再使用 `workspaceId` 命名。

## 4. API

### 4.1 新 API

新增并迁移到以下接口：

- `GET /api/collections?userId=...&areaId=...`
- `POST /api/collections`
- `PUT /api/collections`
- `PATCH /api/collections/[id]`
- `DELETE /api/collections/[id]`

请求和响应字段使用 `collection` / `collections`：

```json
{
  "collection": {
    "id": "col_123",
    "userId": "demo-user",
    "areaId": "area_123",
    "name": "新人培训",
    "topic": null,
    "sortOrder": 0
  }
}
```

### 4.2 素材 API

涉及素材归属的请求参数和响应字段改为 `collectionId`：

- `GET /api/knowledge-items?userId=...&collectionId=...`
- `POST /api/knowledge-items` body 使用 `collectionId`

旧参数 `workspaceId` 不作为公开契约继续支持。若前端迁移后仍传旧参数，应视为测试应捕获的错误。

### 4.3 旧 API

后台内部 API 不兼容 `/api/workspaces`。本次迁移删除旧路由，让测试覆盖所有调用点已切换到 `/api/collections`。

## 5. 前端路由

### 5.1 Collection 路由

将当前工作集编辑页迁移为：

- `/collections/[id]`
- `/collections/[id]/capture`
- `/collections/[id]/structure`
- `/collections/[id]/publish`
- `/collections/[id]/settings`

这些页面语义不变，只是参数名从 `workspace id` 改为 `collection id`。

### 5.2 旧 URL

不保留 `/workspace/*` 旧 URL redirect。实现时一次性移除旧路由目录，并将当前代码、导航、文档中的链接全部改为新 URL：

- `/collections/[id]`
- `/collections/[id]/capture`
- `/collections/[id]/structure`
- `/collections/[id]/publish`
- `/collections/[id]/settings`
- `/unassigned`

### 5.3 未归类素材

未归类素材页面迁移到 `/unassigned`。它继续展示 `collection_id = null` 的素材，不参与 collection tabs。

## 6. 前端组件与状态

组件命名迁移到 collection：

- `WorkspaceLayout` -> `CollectionLayout`
- `WorkspaceNav` -> `CollectionNav`
- `Workspace*` 类型 -> `Collection*` 类型

localStorage key 迁移：

- 旧：`knowledgecast_workspace_id`
- 新：`knowledgecast_collection_id`

读取时可以兼容一次旧 key：如果新 key 不存在但旧 key 存在，用旧值初始化当前 collection，并写入新 key。写入时只写新 key。

## 7. 测试

测试覆盖重点：

1. repository 使用 `collections` 表创建、更新、删除工作集。
2. 素材创建和列表查询使用 `collectionId` / `collection_id`。
3. `/api/collections` 返回 `collection` / `collections` 字段。
4. 前端组件中的链接指向 `/collections/[id]`。
5. 当前代码中不再存在 `/workspace/*` 路由或链接。

不新增导出功能，不改变分享页 `/share/[token]`。

## 8. 文档影响

本次实现完成后同步更新：

- `docs/prd.md`：如果 PRD 中出现工作集数据概念描述，改为 collection 对应中文“工作集”。
- `docs/superpowers/specs/2026-04-25-knowledgecast-design.md`：更新数据模型、路由、UI 概念。
- `docs/api.md`：记录 `/api/collections` 和 `collectionId`，移除 `/api/workspaces` 作为当前 API。
- `AGENTS.md`：如项目技术约定中提到 workspace/collection 命名规则，补充一致性规则。

## 9. 不做的事

- 不改变分享页 token URL：`/share/[token]` 保持不变。
- 不引入 collection slug，仍使用 ID。
- 不改变 area 的数据模型或 UI 文案。
- 不做公开导出能力。
