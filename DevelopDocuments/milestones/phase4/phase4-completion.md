# Phase 4 开发完成文档

**完成日期：** 2026-05-31（更新于 2026-06-02）

---

## 概述

完成 Phase 3 遗留基础设施模块 + Phase 4.2 Diff 展示完善 + Phase 4.3 WorkspacePanel 集成完善。打通了从服务端 workspace → store → UI 的完整数据链路，并新增快照回滚、文件内容查看、面板拖拽、工作目录管理等功能。

---

## 一、Phase 3 遗留项

### 1.1 服务端：WS 连接注册表

**文件：** `apps/server/src/ws/connection-registry.ts`（新建）

- `ConnectionRegistry` 类：管理 WebSocket 连接生命周期（register / unregister / joinRoom / leaveRoom / getRoom）
- 单例导出，集成到 `gateway.ts`

### 1.2 前端：乐观更新工具

**文件：** `apps/web/src/lib/optimistic-updates.ts`（新建）

- `optimisticUpdate()` — 通用乐观写入 + 失败回滚
- `createOptimisticExecutor()` — React 组件级封装

---

## 二、Phase 4.2 对话中 Diff 展示完善

### 2.1 服务端：真实 unified diff 生成

- 安装 `diff` npm 包
- `createSnapshot()` 在 `data/snapshots/<id>/` 下存储文件副本
- `_generateDiff()` 使用 `diffLib.createPatch()` 生成真正 unified diff
- `deleteSnapshot()` 清理快照目录

### 2.2 前端：DiffBlock 统一 diff 渲染

**文件：** `apps/web/src/components/chat/DiffBlock.tsx`（新建）

- 逐行着色：`+` 绿 / `-` 红 / `@@` 蓝 / 上下文灰
- 超过 20 行默认折叠，可展开/收起
- 文件路径头部可点击 → 触发 WorkspacePanel 联动定位

### 2.3 前端：MarkdownContent 内联 Diff

**文件：** `apps/web/src/components/chat/MarkdownContent.tsx`

- `` ```diff `` 代码块使用 `<DiffBlock>` 渲染

### 2.4 前端：DiffCard + 跨组件联动

- `DiffCard.tsx` 使用 `<DiffBlock>` 替代纯文本
- `ui.store.ts` 新增 `selectedChangePath` / `selectChangePath`
- `WorkspacePanel.tsx` 监听 → 自动切换变更 Tab + 蓝色光环高亮

---

## 三、Phase 4.3 WorkspacePanel 集成完善

### 3.1 服务端：文件树 API

- `buildFileTree(rootPath)` — 递归目录扫描，返回 `FileNode[]`
- `GET /api/workspaces/:id/files` — 文件树端点
- `GET /api/workspaces/browse?path=` — 通用目录浏览
- `PATCH /api/workspaces/:id` — 更新 rootPath

### 3.2 前端：Store 集成 + 面板功能

- `workspace.store.ts` — `load()` 加载文件树/快照/变更；`updateRootPath()` 更改目录；`refresh()` 刷新数据
- `App.tsx` — 接入 `useWorkspaceStore` / `useUIStore`，面板折叠/展开/拖拽
- `ChatArea.tsx` — 移除重复 state，WS 事件驱动刷新
- `WorkspacePanel.tsx` — 内联组件替换、面板切换、文件选择、目录更改

### 3.3 快照回滚

- `WorkspaceService.rollbackToSnapshot()` — 清空工作区 → 从快照复制文件
- `POST /api/workspaces/:id/snapshots/:snapshotId/rollback`
- `SnapshotList.tsx` — 回滚按钮 + 二次确认

### 3.4 新增文件内容查看

- `WorkspaceService.readFileContent()` — 文本内容读取 + 二进制检测 + 路径安全校验 + 大小限制
- `GET /api/workspaces/:id/file-content?path=`
- `DiffCard.tsx` — `FileContentViewer` 子组件，合成 unified diff 通过 DiffBlock 渲染

### 3.5 工作目录管理

- Agent 工作目录修复：`workingDir: workspaceRootPath`（原为 `process.cwd()`）
- 默认工作目录：`D:\Projects\MasterOfAgents\Test`
- 手动更改工作目录：文本输入方式
- 新建对话指定工作目录：创建弹窗中可选填写

### 3.6 面板交互

- 面板宽度拖拽调整（240px–600px）
- WS 事件驱动的 workspace 刷新

---

## 关键架构决策

| 决策 | 说明 |
|---|---|
| workspace.store 作为单一数据源 | 文件树、快照、变更仅由 store 管理 |
| ui.store 管理面板状态 | 扩展支持 selectedChangePath 跨组件通信 |
| DiffBlock 为统一 diff 渲染器 | MarkdownContent 和 DiffCard 共享 |
| 快照文件副本存储 | `data/snapshots/<id>/` 支持 diff 和回滚 |
| WS 事件驱动刷新 | run:started/run:completed/file:changed 触发 store 更新 |

---

## 验证结果

- TypeScript 编译：server ✅ / web ✅（零错误）
- 数据链路：store.load() → API → WorkspacePanel 三 Tab 渲染
- 快照回滚：确认后恢复文件 → 文件树自动刷新
- Diff 渲染：`+` 绿 / `-` 红 / `@@` 蓝 / 长 diff 折叠
- 联动：点击 diff 路径 → WorkspacePanel 变更 Tab + 高亮
- 面板拖拽：240–600px，实时调整

---

## 四、2026-06-02 BUG 修复

### 4.1 Planner 任务 ID 碰撞 → 消息消失

**问题：** Planner LLM 生成固定 ID（`task-1`、`task-2`），跨运行冲突导致 `UNIQUE constraint failed: tasks.id`，前端临时消息被移除。

**修复：** `orchestrator.service.ts` — 在 DB 写入前将 planner ID 映射为 `newId()` 生成的 UUID，同时重映射 `dependencies` 引用。

### 4.2 对话删除后磁盘孤儿数据残留

**问题：** `deleteConversation` 只清理 DB 行，`data/snapshots/<id>/` 和 `data/workspaces/<id>/` 目录留在磁盘。

**修复：** `chat.service.ts` — 删除对话前遍历 workspace → snapshot，先 `fs.rmSync` 删除磁盘目录，再删除 DB 行。

### 4.3 跨对话 FileChange 串味

**问题：** 全局 Zustand store 导致 A 对话的变更显示在 B 对话框中。切换对话时 HTTP `load()` 的飞行中响应与 WS 事件交错覆盖。

**修复：** `workspace.store.ts` — 新增 `activeConversationId` 追踪；切换对话时清空状态；飞行中响应若 `activeConversationId` 不匹配则丢弃；`updateFileChange` 采用 upsert 模式。

### 4.4 快照递归复制自身 → ENAMETOOLONG

**问题：** 当 workspace rootPath 覆盖 `data/snapshots/` 所在目录树时，`_copyDir` 将快照目录复制进自身，导致无限嵌套路径和 `ENAMETOOLONG` 错误。

**修复：** `workspace.service.ts`
- `_copyDir()`: 增加循环检测（dest 在 src 内则跳过） + 跳过 `node_modules`/`data`/`.git`
- `_buildTree()`: 增加深度上限 20 层 + 同样跳过上述目录
- 清理了所有被污染的磁盘快照文件和 DB 记录

### 4.5 FileChange 通知不出现（BUG #1）

**问题：** Agent 回复完毕后 FileChangeList 不显示文件变更，需刷新页面后才出现。WS `file:changed` 事件 + HTTP `load()` 双通道均无法实时送达前端。

**状态：** ✅ 已修复（校验通过）
