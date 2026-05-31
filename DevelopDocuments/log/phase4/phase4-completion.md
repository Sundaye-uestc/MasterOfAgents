# Phase 4 开发完成文档

**完成日期：** 2026-05-31

---

## 概述

完成 Phase 3 两个遗留基础设施模块 + Phase 4.2 Diff 展示完善 + Phase 4.3 WorkspacePanel 集成完善，打通了从服务端 workspace → store → UI 的完整数据链路。

---

## 一、Phase 3 遗留项

### 1.1 服务端：WS 连接注册表

**文件：** `apps/server/src/ws/connection-registry.ts`（新建）

- `ConnectionRegistry` 类：管理 WebSocket 连接生命周期
- 方法：`register` / `unregister` / `joinRoom` / `leaveRoom` / `getRoom` / `getConnection` / `heartbeat`
- 单例 `connectionRegistry` 实例导出

**文件：** `apps/server/src/ws/gateway.ts`
- 替换模块级 `Map` 为 `ConnectionRegistry` 单例
- 连接时注册（含计数日志），断线时取消注册

### 1.2 前端：乐观更新工具

**文件：** `apps/web/src/lib/optimistic-updates.ts`（新建）
- `optimisticUpdate()` — 通用乐观写入 + 失败回滚
- `createOptimisticExecutor()` — React 组件级封装
- 支持 `apply` → `execute` → `reconcile` / `rollback` 生命周期

---

## 二、Phase 4.3 WorkspacePanel 集成完善

### 2.1 服务端：文件树 API 端点

**文件：** `apps/server/src/services/workspace.service.ts`
- 新增 `buildFileTree(rootPath)` — 递归扫描目录，返回嵌套 `FileNode[]`（目录在前，跳过隐藏文件）
- 导出 `FileNode` 接口

**文件：** `apps/server/src/routes/workspaces.ts`
- 新增 `GET /api/workspaces/:id/files`

**文件：** `apps/web/src/lib/api.ts`
- 新增 `listFiles(workspaceId)`

### 2.2 前端：workspace.store 扩展与 App.tsx 集成

**文件：** `apps/web/src/stores/workspace.store.ts`
- `load()` 同时加载文件树、快照、变更

**文件：** `apps/web/src/App.tsx`
- 引入 `useWorkspaceStore` / `useUIStore`，移除本地 `fileChanges` state
- WorkspacePanel 接收真实数据，面板折叠/展开切换
- 对话切换时自动加载 workspace + 打开面板
- 面板隐藏时显示折叠按钮

### 2.3 前端：ChatArea 去重 + WS 事件刷新

**文件：** `apps/web/src/components/chat/ChatArea.tsx`
- 移除本地 `fileChanges` 和重复的 `listFileChangesByConversation` 调用
- 移除 `onFileChangesSync` prop
- WS `file:changed` 直接调用 `workspaceUpdateFileChange`
- WS `run:started` / `run:completed` 触发 `workspaceLoad` 刷新（修复工作区延迟创建导致的面板空白 Bug）

### 2.4 前端：WorkspacePanel 组件去重

**文件：** `apps/web/src/components/workspace/WorkspacePanel.tsx`
- 移除内联 `WorkspaceFileTree`、`WorkspaceSnapshotList`、`FileTreeItem`
- 导入并使用独立 `FileTree` / `SnapshotList` 组件
- 新增 `onTogglePanel`、`onFileSelect` props

---

## 三、Phase 4.2 对话中 Diff 展示完善

### 3.1 服务端：真实 unified diff 生成

**文件：** `apps/server/src/services/workspace.service.ts`
**依赖：** `diff` npm 包

- `createSnapshot()` 在 `data/snapshots/<id>/` 下存储文件副本
- `_generateDiff()` 使用 `diffLib.createPatch()` 生成真正 unified diff（替换哈希截断）
- `deleteSnapshot()` 清理快照目录
- 新增辅助方法：`_snapshotDir()`、`_copyDir()`、`_findWorkspaceFile()`、`_getSnapshotSync()`、`_getWorkspaceSync()`

### 3.2 前端：DiffBlock 统一 diff 渲染组件

**文件：** `apps/web/src/components/chat/DiffBlock.tsx`（新建）
- 解析 unified diff 为类型化行（add / remove / header / meta / context）
- 逐行着色：`+` 绿 / `-` 红 / `@@` 蓝 / 上下文灰
- 文件路径头部可点击 → 触发 WorkspacePanel 联动定位
- 超过 20 行默认折叠，可展开/收起

### 3.3 前端：MarkdownContent 内联 Diff 渲染

**文件：** `apps/web/src/components/chat/MarkdownContent.tsx`
- `` ```diff `` 代码块使用 `<DiffBlock>` 渲染替代纯文本

### 3.4 前端：DiffCard + 跨组件联动

**文件：** `apps/web/src/components/workspace/DiffCard.tsx`
- 使用 `<DiffBlock>` 替代纯文本 `<pre>`

**文件：** `apps/web/src/stores/ui.store.ts`
- 新增 `selectedChangePath` / `selectChangePath` 用于交叉组件通信

**文件：** `apps/web/src/components/workspace/WorkspacePanel.tsx`
- 监听 `selectedChangePath` → 自动切换变更 Tab + 蓝色光环高亮

---

## 关键架构决策

| 决策 | 说明 |
|---|---|
| workspace.store 作为单一数据源 | 文件树、快照、变更仅由 store 加载和存储 |
| 面板状态在 ui.store 管理 | 未来扩展 artifacts / deployments 面板 |
| 文件树 API 在后端构建 | 直接扫描磁盘目录 |
| ConnectionRegistry 为单例 | 全局连接状态可被多服务访问 |
| DiffBlock 为统一 diff 渲染器 | MarkdownContent 和 DiffCard 共享同一组件 |
| WS 事件驱动 workspace 刷新 | run:started/run:completed 触发重新加载，解决延迟创建问题 |

---

## 验证结果

- TypeScript 编译：server ✅ / web ✅（零错误）
- 数据链路：store.load() → API → WorkspacePanel 渲染
- WS 事件：file:changed / run:started / run:completed → store 更新 / 刷新
- Diff 渲染：`+` 绿 / `-` 红 / `@@` 蓝 / 上下文灰，长 diff 折叠
- 联动：点击 diff 文件路径 → WorkspacePanel 变更 Tab + 高亮
