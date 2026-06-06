# AgentHub 待办事项

**更新日期：** 2026-06-06

---

## 桌面端开发（MVP）

> 设计文档：[系统设计](./designs/AgentHub-桌面端系统设计.md) · [模块设计](./designs/AgentHub-桌面端模块设计.md)
> 
> 技术栈：Electron + 复用 `apps/web` + 内置 `apps/server`
> 
> 核心能力：本地文件访问 / Agent 进程管理 / 系统通知 / 本地预览服务

### Step 1: Electron Shell — 窗口 + 加载 Web UI

- [ ] 创建 `AgentHub/apps/desktop/`：`package.json`、`tsconfig.json`、`electron-builder.yml`
- [ ] `src/main/index.ts`：Electron app 生命周期（ready / window-all-closed / activate）
- [ ] BrowserWindow 创建，加载 `apps/web` 构建产物（开发期加载 dev server URL）
- [ ] 窗口关闭 → `app.quit()`（MVP "关闭即停止"）
- [ ] `src/main/preload.ts`：`contextBridge` 暴露安全 API 壳

### Step 2: Server Lifecycle — 本地服务端启停

- [ ] `src/main/server-lifecycle.ts`：启动 `apps/server`（Node child_process）
- [ ] 端口探测：默认 3000，被占用则自动递增
- [ ] `startServer(workspacePath)` / `stopServer()` / `getServerStatus()`
- [ ] BrowserWindow 加载 `http://127.0.0.1:<port>`
- [ ] 窗口关闭时自动停止 server

### Step 3: Workspace 选择 — 原生文件夹选择器 + IPC

- [ ] `src/main/ipc-handlers.ts`：注册 `desktop:select-workspace` IPC handler
- [ ] 调用 `dialog.showOpenDialog({ properties: ["openDirectory"] })`
- [ ] `preload.ts`：`desktopApi.selectWorkspace()` 暴露给 Renderer
- [ ] 路径回传：Renderer → Local Backend → Agent CLI cwd
- [ ] 记录最近 workspace 路径

### Step 4: IPC 桥接框架

- [ ] 完善 `ipc-handlers.ts`：注册全部 IPC handler（workspace / secret / notification / cli-status / server-status）
- [ ] 完善 `preload.ts`：`desktopApi` 完整 API 暴露
- [ ] Renderer 端类型声明（`window.desktopApi` 类型）

### Step 5: CLI 检测 — Claude Code 可用性

- [ ] `src/main/cli-detection.ts`：执行 `claude --version` 检测可用性
- [ ] 简化策略：Claude Code 可用 → codex、opencode 全显示可用
- [ ] 通过 IPC 暴露给 Web UI（`desktop:get-cli-status`）
- [ ] Web UI 根据状态控制 Agent 选择器的可选状态

### Step 6: Secure Storage — 本机密钥加密存储

- [ ] `src/main/secure-storage.ts`：封装 Electron `safeStorage` API
- [ ] `setSecret()` / `getSecret()` / `deleteSecret()`
- [ ] 存储位置：`app.getPath("userData")` 下的加密文件
- [ ] 通过 IPC 暴露给 Web UI

### Step 7: 系统通知 — Electron Notification

- [ ] `src/main/notification.ts`：封装 Electron Notification API
- [ ] 场景 1：Agent run 完成/失败
- [ ] 场景 2：权限审批请求（`permission:requested` WS 事件 → 通知）
- [ ] 场景 3：高风险操作预警
- [ ] 点击通知 → 聚焦主窗口
- [ ] Windows appUserModelId 配置

### Step 8: 本地预览服务

- [ ] `src/main/preview-server.ts`：在 workspace 目录启动静态文件 HTTP server
- [ ] 仅监听 `127.0.0.1`，端口为 Local Backend 端口 +1000
- [ ] `getPreviewUrl(relativePath)` → 传给 WebPreviewCard
- [ ] 支持 HTML、图片、前端构建输出等类型

### 打包

- [ ] `electron-builder.yml` 配置：Windows NSIS `.exe`
- [ ] apps/server 和 apps/web 的构建产物纳入打包
- [ ] 验证安装包可正常运行
