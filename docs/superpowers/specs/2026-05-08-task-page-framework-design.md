# 任务页基础框架与阶段表达设计

## 目标

将 `/collections/[id]` 从简单的三卡片入口仪表盘改造为四区布局的阶段驱动任务工作台，承载从采集、整理、创作到发布迭代的最小闭环。

## 布局结构

四区布局，在现有 CollectionLayout 基础上改造：

```
┌──────────────────────────────────────────────────┐
│ 顶部状态区：面包屑、阶段标签、下一步动作按钮      │
├────────┬───────────────────────────┬──────────────┤
│ 左侧   │ 中央工作区               │ 右侧上下文区 │
│ 结构区 │ (阶段驱动)               │ (依据、缺口、│
│        │                           │  反馈、风险) │
├────────┴───────────────────────────┴──────────────┤
│ 左侧 Sidebar (保留)                              │
└──────────────────────────────────────────────────┘
```

## 阶段与视图映射

五个阶段：采集(capture)、整理(organize)、创作(create)、可用(publish)、迭代(iterate)。

| 阶段 | 左侧结构区 | 中央工作区 | 右侧上下文区 |
|------|-----------|-----------|-------------|
| 采集 | 材料列表 | 材料输入 + 材料总览 | 材料充足性、缺口提示 |
| 整理 | 可编辑骨架树 | 主线说明 + 骨架节点详情 | 当前节点依据、缺口 |
| 创作 | 骨架导航 | 策划卡 + 内容编辑 | 依据、缺口、风险 |
| 可用 | 版本结构 | 版本预览 + 分享链接 | QA 门检查项 |
| 迭代 | 上一版本结构 | 版本对比概览 | 新材料、反馈 |

## 阶段切换机制

混合模式：后端存储 phase，关键动作显式推进，允许手动退回。

- phase 存储在 Collection 表的 `phase` 字段
- 推进方式：完成关键动作后的显式按钮（如"确认骨架，进入创作"），非 tab 点击
- 退回方式：用户可随时退回到任意阶段（如回到采集补材料）
- 初始值：新建 Collection 默认为 `capture`

## 导航改造

- 移除顶部 tab 导航（采集、整理、发布）
- 顶部改为状态区：面包屑 + 阶段标签 + 下一步动作按钮
- 设置入口收进右侧齿轮图标
- `+ 新建素材` 按钮保留，不受阶段影响
- 现有子页面（/capture、/structure、/publish）保留，重定向到 `/collections/[id]?phase=X`

## 组件拆分

```
src/app/collections/[id]/page.tsx        # 任务页主入口，phase state 持有者
src/components/collection/
  CollectionLayout.tsx                   # 微调：支持四区布局
  CollectionNav.tsx                      # 改造：移除 tab，替换为阶段状态区
  Sidebar.tsx                            # 保留不变
  StructurePanel.tsx                     # 新建：左侧结构区
  TaskContextPanel.tsx                   # 新建：右侧上下文区
  phases/
    CaptureWorkspace.tsx                 # 采集阶段中央工作区
    OrganizeWorkspace.tsx                # 整理阶段中央工作区
    CreateWorkspace.tsx                  # 创作阶段中央工作区
    PublishWorkspace.tsx                 # 可用阶段中央工作区
    IterateWorkspace.tsx                 # 迭代阶段中央工作区
```

phase 状态在 page.tsx 通过 useState 持有，通过 props 下传。阶段推进函数由 page.tsx 提供，各 PhaseWorkspace 在完成关键动作后调用。

## 数据模型变更

Collection 表新增 phase 字段：

```sql
ALTER TABLE collections ADD COLUMN phase TEXT NOT NULL DEFAULT 'capture';
```

涉及文件：
- `src/server/db/schema.ts` — 新增 `phase` 列定义
- `drizzle/0010_task_phase.sql` — 新增迁移
- `src/app/api/collections/[id]/route.ts` — PATCH 已支持任意字段更新，phase 透传即可

## MVP 实现优先级

1. 四区布局骨架 + 阶段状态管理
2. 顶部状态区改造
3. 采集阶段中央工作区
4. 整理阶段（骨架为核心）
5. 创作阶段
6. 可用阶段
7. 迭代阶段

## 非目标

- 不新增独立 Task 数据对象（Collection 承担培训任务角色）
- 不改变 Sidebar 结构
- 不一次性实现所有阶段完整功能（先采集和整理）
- 不做复杂反馈治理、审批、权限流
