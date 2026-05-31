# Phase 3 遗留项 + Phase 4.3 WorkspacePanel 集成 — 开发完成文档

**完成日期：** 2026-05-31

---

## 概述

完成 Phase 3 两个遗留基础设施模块（`connection-registry.ts`、`optimistic-updates.ts`）和 Phase 4.3 WorkspacePanel 集成完善（文件树、快照列表、面板切换、组件去重），打通了 workspace.store → App.tsx → WorkspacePanel 的数据链路。

---

## 实现清单

### 1. 服务端：文件树 API 端点

**文件：** `apps/server/src/services/workspace.service.ts`
- 新增 `buildFileTree(rootPath)` 方法：递归扫描目录，返回嵌套 `FileNode[]` 树结构（目录在前，字母排序，跳过隐藏文件）
- 新增 `_buildTree()` 私有辅助方法
- 导出 `FileNode` 接口

**文件：** `apps/server/src/routes/workspaces.ts`
- 新增 `GET /api/workspaces/:id/files` — 返回工作区文件树

**文件：** `apps/web/src/lib/api.ts`
- 新增 `listFiles(workspaceId)` API 客户端函数

### 2. 服务端：WS 连接注册表

**文件：** `apps/server/src/ws/connection-registry.ts`（新建）
- `ConnectionRegistry` 类：管理 WebSocket 连接生命周期
- 方法：`register` / `unregister` / `joinRoom` / `leaveRoom` / `getRoom` / `getConnection` / `heartbeat`
- 单例 `connectionRegistry` 实例导出

**文件：** `apps/server/src/ws/gateway.ts`
- 替换模块级 `Map<string, Set<WebSocket>>` 为 `ConnectionRegistry` 单例
- 连接时注册（含计数日志），断线时取消注册
- `broadcastToConversation` 通过注册表遍历房间连接

### 3. 前端：乐观更新工具

**文件：** `apps/web/src/lib/optimistic-updates.ts`（新建）
- `optimisticUpdate()` — 通用乐观写入 + 失败回滚
- `createOptimisticExecutor()` — React 组件级封装
- 支持 `apply` → `execute` → `reconcile` / `rollback` 生命周期

### 4. 前端：工作区 Store 扩展

**文件：** `apps/web/src/stores/workspace.store.ts`
- `load()` 现在同时加载文件树（调用 `listFiles`）
- 快照加载和文件加载均使用独立 try/catch，互不影响

### 5. 前端：App.tsx Store 集成

**文件：** `apps/web/src/App.tsx`
- 移除本地 `fileChanges` useState 和 `handleFileChangesSync` 回调
- 移除 `listFileChangesByConversation` useEffect
- 引入 `useWorkspaceStore`、`useUIStore`
- 对话切换时自动加载 workspace 数据 + 打开工作区面板
- WorkspacePanel 接收真实 `workspaceFiles` / `workspaceSnapshots` / `workspaceFileChanges`

### 6. 前端：ChatArea 去重

**文件：** `apps/web/src/components/chat/ChatArea.tsx`
- 移除本地 `fileChanges` useState
- 移除重复的 `listFileChangesByConversation` 调用
- 移除 `onFileChangesSync` prop 和同步 useEffect
- WS `file:changed` 事件直接调用 `workspaceUpdateFileChange`
- FileChangeList 使用 store 数据

### 7. 前端：WorkspacePanel 组件去重

**文件：** `apps/web/src/components/workspace/WorkspacePanel.tsx`
- 移除内联 `WorkspaceFileTree`、`WorkspaceSnapshotList`、`FileTreeItem`、`sortNodes`
- 改为导入并使用独立的 `FileTree` 和 `SnapshotList` 组件
- 新增 `onTogglePanel` 和 `onFileSelect` props

### 8. 前端：面板可见性切换

**文件：** `apps/web/src/App.tsx`
- 使用 `useUIStore` 管理面板状态
- 面板隐藏时显示折叠按钮（右边缘），点击展开
- 面板显示时顶部 ✕ 按钮可关闭

### 9. 前端：文件选择状态

**文件：** `apps/web/src/components/workspace/WorkspacePanel.tsx`
- 新增 `onFileSelect` 回调 prop
- 文件点击时同时更新本地选中状态和通知父组件

---

## 关键架构决策

| 决策 | 说明 |
|---|---|
| workspace.store 作为单一数据源 | 文件树、快照、变更有且仅有 store 加载和存储 |
| 面板状态在 ui.store 管理 | 未来扩展更多面板（artifacts, deployments） |
| 文件树 API 在后端构建 | 直接扫描磁盘目录，避免前端重复实现 |
| ConnectionRegistry 为单例 | 全局连接状态可被多个服务访问 |

---

## 验证结果

- TypeScript 编译：server ✅ / web ✅（零错误）
- 数据链路：store.load() → API → WorkspacePanel 渲染
- WS 事件：file:changed → store.updateFileChange → UI 响应
