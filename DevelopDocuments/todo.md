# AgentHub 待办事项

**更新日期：** 2026-06-07

---

## 桌面端开发（MVP）

> 设计文档：[系统设计](./designs/AgentHub-桌面端系统设计.md) · [模块设计](./designs/AgentHub-桌面端模块设计.md)
> 
> 技术栈：Electron + 复用 `apps/web` + 内置 `apps/server`
> 
> 核心能力：本地文件访问 / Agent 进程管理 / 系统通知 / 本地预览服务

### Step 1: Electron Shell — 窗口 + 加载 Web UI

- [x] 创建 `AgentHub/apps/desktop/`：`package.json`、`tsconfig.json`、`electron-builder.yml`
- [x] `src/main/index.ts`：Electron app 生命周期（ready / window-all-closed / activate）
- [x] BrowserWindow 创建，加载 `apps/web` 构建产物（开发期加载 dev server URL）
- [x] 窗口关闭 → `app.quit()`（MVP "关闭即停止"）
- [x] `src/main/preload.ts`：`contextBridge` 暴露安全 API 壳
- [x] Dev 模式 wrapper（`scripts/electron-dev.js`）解决 ELECTRON_RUN_AS_NODE 环境变量问题

### Step 2: Server Lifecycle — 本地服务端启停

- [x] `src/main/server-lifecycle.ts`：启动 `apps/server`（Node child_process）
- [x] 端口探测：默认 3001，被占用则自动递增
- [x] `startServer()` / `stopServer()` / `getServerStatus()`
- [x] IPv4/IPv6 双栈端口检测（`127.0.0.1` + `::1`）
- [x] 打包模式 ESM 模块解析：`ensureServerNodeModules()` junction 桥接
- [x] 30 秒启动超时保护

### Step 3: Workspace 选择 — 原生文件夹选择器 + IPC

- [x] `src/main/ipc-handlers.ts`：注册 `desktop:select-workspace` IPC handler
- [x] 调用 `dialog.showOpenDialog({ properties: ["openDirectory"] })`
- [x] `preload.ts`：暴露给 Renderer
- [x] 记录最近 workspace 路径（`userData/recent-workspace.json`）

### Step 4: IPC 桥接框架

- [x] 完善 `ipc-handlers.ts`：注册全部 IPC handler（workspace / server-status / cli-status / notification / preview-server）
- [x] 完善 `preload.ts`：`desktopApi` 完整 API 暴露

### Step 5: CLI 检测 — Claude Code 可用性

- [x] `src/main/cli-detection.ts`：执行 `claude --version` 检测可用性
- [x] 简化策略：Claude Code 可用 → codex、opencode 全显示可用
- [x] 通过 IPC 暴露给 Web UI（`desktop:get-cli-status`）

### Step 6: Secure Storage — 本机密钥加密存储

- [x] **已跳过**（保持 Demo 简洁，不做加密存储）

### Step 7: 系统通知 — Electron Notification

- [x] `src/main/notification.ts`：封装 Electron Notification API
- [x] Windows appUserModelId 配置

### Step 8: 本地预览服务

- [x] `src/main/preview-server.ts`：在 workspace 目录启动静态文件 HTTP server
- [x] 仅监听 `127.0.0.1`
- [x] 支持 HTML、图片、前端构建输出等类型

### 打包

- [x] `electron-builder.yml` 配置：Windows dir 目标（winCodeSign symlink 问题 workaround）
- [x] apps/server 和 apps/web 的构建产物纳入打包（`extraResources`）
- [x] `asarUnpack` 提取 node_modules 供 server 子进程使用
- [x] `@agenthub/shared` 注入到 unpacked node_modules
- [x] server/node_modules junction 桥接
- [x] 一键构建脚本 `scripts/build-portable.mjs`（`pnpm build:portable`）
- [x] 便携版启动器 `启动AgentHub.bat`（清除 ELECTRON_RUN_AS_NODE）
- [x] 开发模式一键启动：server + web + mobile + desktop

---

## 移动端开发（MVP）

> 设计文档：[系统设计](./designs/AgentHub-移动端系统设计.md) · [模块设计](./designs/AgentHub-移动端模块设计.md)
> 
> 技术栈：Vite + React + Tailwind v4 + PWA，复用 `@agenthub/web` stores/API/hooks/components

### Step 1: 基础设施 — 脚手架 + 路由 + 网络检测

- [x] `apps/mobile/` 目录创建（package.json、tsconfig.json、vite.config.ts、index.html）
- [x] web package.json 添加 `exports` 字段供 mobile 复用
- [x] `mobile-ui.store.ts`：Zustand stack 导航
- [x] `useNetworkStatus.ts`：online/offline 监听
- [x] `OfflinePage.tsx`

### Step 2: 会话列表

- [x] `ConversationListPage.tsx`
- [x] `MobileConversationItem.tsx`
- [x] `MobileConversationSearchBar.tsx`
- [x] `MobileNewConversationModal.tsx`

### Step 3: 聊天页（只读消息）

- [x] `ChatPage.tsx`
- [x] `MobileMessageList.tsx`
- [x] `MobileMessageBubble.tsx`
- [x] `MobilePinnedContext.tsx`

### Step 4: WebSocket 状态同步

- [x] `ChatPage.tsx` 集成 WebSocket，处理全部事件

### Step 5: 消息发送

- [x] `MobileMessageInput.tsx`
- [x] `MobileMentionPicker.tsx`

### Step 6: Run 停止 + 运行状态展示

- [x] `RunStatusBanner.tsx`
- [x] `TaskProgressList.tsx`
- [x] `ToolInvocationList.tsx`
- [x] `StopRunButton.tsx`

### Step 7: 审批面板

- [x] `ApprovalPage.tsx`
- [x] `MobileDiffSummary.tsx`

### Step 8: Artifact 预览

- [x] `ArtifactPreviewPage.tsx`
- [x] `MobileArtifactCard.tsx`
- [x] `MobileWebPreviewLink.tsx`
- [x] `MobileFileViewer.tsx`
- [x] `MobileDeployStatus.tsx`

### Step 9: 移动端适配收尾

- [ ] ≥44px 触摸目标验证
- [ ] 安全区域适配（safe-area-inset）
- [ ] 暗色模式测试
- [ ] PWA service worker 修复（vite-plugin-pwa 配置）

---

## 待处理问题

- [ ] **winCodeSign 7za symlink 错误**：Windows 非开发者模式下，`electron-builder` 下载 winCodeSign 时 7za 无法创建 macOS dylib 符号链接。当前 workaround：使用 `--dir` 目标 + `ignoreError`。彻底修复需开启 Windows 开发者模式或升级 electron-builder
- [ ] **app.asar 文件锁定**：`AgentHub-Desktop-Portable/resources/app.asar` 有时被系统进程锁定无法覆盖，需重启后替换
- [ ] **移动端 PWA 构建**：`vite-plugin-pwa` precaching 配置需修复（当前 `pnpm -r build` 跳过 mobile）

---

## 完成摘要

| 模块 | 状态 |
|------|------|
| Electron Shell + 窗口管理 | ✅ 完成 |
| Server 生命周期管理 | ✅ 完成 |
| Workspace 选择器 | ✅ 完成 |
| IPC 桥接 | ✅ 完成 |
| CLI 检测 | ✅ 完成 |
| 系统通知 | ✅ 完成 |
| 本地预览服务 | ✅ 完成 |
| 一键打包脚本 | ✅ 完成 |
| 移动端 MVP (Step 1-8) | ✅ 完成 |
| 移动端收尾 (Step 9) | 🔧 进行中 |
