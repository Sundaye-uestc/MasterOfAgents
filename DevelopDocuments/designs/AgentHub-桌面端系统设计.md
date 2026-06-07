# AgentHub 桌面端系统设计

## 1. 定位

桌面端用于增强 Web 端无法稳定覆盖的本机能力：

- 本地 workspace 选择与文件访问
- 本地 Agent CLI/SDK 进程管理
- 系统通知
- 本地预览服务

桌面端不是 Web 端的替代品。MVP 可先用 Web UI + Desktop Shell 承载同一前端。

## 2. 桌面端独有能力

### 2.1 本地文件访问

桌面端与 Web 端的核心差异在于 workspace 位置：

| | Web 端 | 桌面端 |
|---|---|---|
| Workspace 位置 | 服务端目录 | 用户本机目录 |
| 文件访问方式 | 上传/下载 | Agent 原生读写本地文件系统 |
| Agent CLI cwd | 服务端路径 | 用户选择的本地 workspace 路径 |
| FileChange 来源 | 服务端文件系统 | 本机文件系统直接变更 |

**工作流程**：用户创建会话时通过原生文件夹选择器指定本地 workspace 目录 → Electron Main Process 将路径传给 Local Backend → Agent CLI 子进程的 `cwd` 设置为该路径 → Agent 直接在用户本机文件中读/写/修改。

桌面端无需文件上传即可让 Agent 操作本地项目，也无需下载即可查看 Agent 产出的文件。这是桌面端相对 Web 端最根本的优势。

### 2.2 Agent 进程管理

桌面端直接管理用户本机的 Agent CLI 进程，复用现有 `ProcessSupervisor`：

- **启动**：用户发起 run → Local Backend 通过 ProcessSupervisor 创建子进程
- **监控**：stdout/stderr 流式转发到 Web UI，exit/timeout/error 事件驱动状态更新
- **停止**：用户点击停止 → 进程树终止（Windows: `taskkill /T /F`，Unix: SIGTERM → SIGKILL）
- **生命周期**：关闭窗口 → Main Process 停止所有 Agent 进程 + 停止 server

### 2.3 系统通知

桌面端通过 Electron Notification API 发出系统级通知，覆盖以下场景：

| 场景 | 说明 |
|---|---|
| Agent run 完成 | 无论成功/失败，及时通知用户结果 |
| 权限审批请求 | `permission:requested` 事件到达时弹出通知，即使用户切到其他窗口也不会错过 |
| 高风险操作预警 | Agent 即将执行高风险命令时抢先通知 |
| 长时间静默恢复 | Run 从长时间等待中恢复执行时提醒用户 |

通知在 BrowserWindow 最小化或不在前台时尤其关键——这是 Web 端依赖浏览器内通知无法稳定覆盖的能力。

### 2.4 本地预览服务

桌面端内置轻量本地 HTTP 静态文件服务器，直接 serve workspace 目录下的产物文件：

- **用途**：Agent 生成的 HTML 页面、图片、前端构建输出等产物，用户可直接在桌面端 WebView 中预览，无需部署到外部服务
- **安全边界**：仅监听 `127.0.0.1`，仅暴露 workspace 目录，仅桌面进程可访问
- **实现**：Electron Main Process 在 workspace 目录上启动静态文件 server（`express.static` 或内置 `http` 模块），将 URL 传给 Renderer 的 WebPreviewCard 进行内嵌预览

## 3. 技术栈

| 层 | 选型 |
|---|---|
| Desktop Shell | Electron（与现有 Node.js 技术栈一致） |
| UI | 复用 `apps/web` |
| Backend Bridge | Electron main process（直接跑 apps/server） |
| 本地存储 | SQLite + Local FS |
| 进程管理 | Node child_process（复用 ProcessSupervisor） |
| 通信 | WebSocket + HTTP（Renderer ↔ Local Backend，复用现有业务协议）；Electron IPC（Renderer ↔ Main Process，原生能力桥接） |
| 打包 | electron-builder → Windows `.exe`（NSIS 安装包）、macOS `.dmg`、Linux `.AppImage` |

## 4. 架构

```text
AgentHub Desktop
├── Electron Main Process
│   ├── Server Lifecycle（启动/停止 apps/server，端口探测）
│   ├── ProcessSupervisor（管理 Agent CLI 子进程）
│   ├── Native Dialogs（文件夹选择器、确认框）
│   ├── System Notifications（桌面通知）
│   └── Secure Storage（本机密钥存储）
├── Electron Renderer Process（BrowserWindow）
│   └── Web UI（复用 apps/web，通过 localhost:<port> 连接本地 server）
├── Local Backend（apps/server，Main Process 启动）
│   ├── HTTP + WebSocket
│   ├── Agent Runtime
│   └── WorkspaceService
└── Platform Agent Processes（ProcessSupervisor 管理）
    ├── claude
    ├── codex
    └── opencode
```

## 5. 运行模式

| 模式 | 说明 |
|---|---|
| Bundled Local | 桌面端启动内置 server（自动探测空闲端口），UI 连接 `localhost:<port>` |
| Remote Backend | 桌面端只提供本机桥接能力，主服务仍在远端 |
| Hybrid | 默认使用本地 runtime，数据可连接远端后端 |

MVP 采用 `Bundled Local`。

### 5.1 代码目录

遵循现有 monorepo 惯例，新增 `AgentHub/apps/desktop/`：

```
AgentHub/
├── apps/
│   ├── server/         ← 已有
│   ├── web/            ← 已有
│   ├── mobile/         ← 已有
│   └── desktop/        ← 新增
│       ├── package.json
│       ├── electron-builder.yml
│       ├── tsconfig.json
│       └── src/
│           ├── main/             # Electron Main Process
│           │   ├── index.ts      # 入口：窗口创建、server 生命周期
│           │   ├── server-lifecycle.ts  # 启动/停止 apps/server + 端口探测
│           │   ├── ipc-handlers.ts      # IPC 处理：文件夹选择、安全存储、通知
│           │   └── preload.ts           # contextBridge 暴露安全 API
│           └── renderer/         # 零代码，直接加载 apps/web
```

Renderer 层不复刻代码——Electron BrowserWindow 直接加载 `apps/web` 构建产物。

## 6. 安全边界

- 用户创建会话时通过原生文件夹选择器选择 workspace 根目录（与 Web 端行为一致）。
- Agent 只能访问已授权 workspace。
- 高风险操作：Electron 发出系统级通知，复用现有 ApprovalPage 权限审批链路（permission:requested → approve/deny → permission:respond）。
- secret 存入系统安全存储，禁止写入普通日志。
- 桌面端暴露本地 server 时只监听 `127.0.0.1`。

## 7. 与 Web 端关系

- UI 复用 `apps/web`。
- shared types/schemas 复用 `packages/shared`。
- 桌面端新增 native capabilities，不改变 Web 核心协议。

## 8. MVP 验收

- [ ] 桌面端可打开 Web UI
- [ ] 创建会话时可通过原生文件夹选择器选择本地 workspace
- [ ] 检测 Claude Code CLI 是否可用，可用则全部显示为可用（简化策略）
- [ ] 可启动本地 Agent run
- [ ] 可收到系统通知
- [ ] 关闭窗口 → 停止所有 Agent 进程 + 停止本地 server（MVP 采用"关闭即停止"，后续可升级为托盘后台模式）

