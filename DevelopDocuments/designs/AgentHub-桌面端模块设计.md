# AgentHub 桌面端模块设计

> 基于 [AgentHub-桌面端系统设计](./AgentHub-桌面端系统设计.md)，Electron 双进程模型，MVP 采用 Bundled Local 模式。

## 1. 模块边界

```text
apps/desktop/src/
├── main/                          # Electron Main Process
│   ├── index.ts                   # 入口：BrowserWindow 创建、app 生命周期
│   ├── server-lifecycle.ts        # 启动/停止 apps/server + 端口探测
│   ├── process-supervisor.ts      # 复用 apps/server 的 ProcessSupervisor
│   ├── ipc-handlers.ts            # IPC 处理：workspace 选择、安全存储、通知
│   ├── notification.ts            # Electron Notification 封装
│   ├── secure-storage.ts          # 本机密钥存储（safeStorage）
│   ├── cli-detection.ts           # 检测 Claude Code CLI 是否可用
│   ├── preview-server.ts          # 本地静态文件预览服务
│   └── preload.ts                 # contextBridge 暴露安全 API
└── renderer/                      # 零代码，加载 apps/web 构建产物
```

## 2. `index.ts` — 入口 + 窗口管理

职责：

- 创建 BrowserWindow，加载 Web UI。
- 管理 app 生命周期（ready / window-all-closed / activate）。
- 窗口关闭 → 停止 Agent 进程 + 停止 server（MVP "关闭即停止"，不保留托盘）。

关键流程：

```text
app.whenReady()
  → cli-detection 检测 Claude Code
  → server-lifecycle 启动 Local Backend（自动探测空闲端口）
  → 创建 BrowserWindow，loadURL(`http://127.0.0.1:<port>`)
  → 注册 IPC handlers

window.on("closed")
  → process-supervisor.stopAll()
  → server-lifecycle.stop()
  → app.quit()
```

关键接口：

```ts
createMainWindow(port: number): BrowserWindow
```

## 3. `server-lifecycle.ts` — 本地服务端生命周期

职责：

- 启动 `apps/server` 的 Node.js 进程。
- 启动前自动探测空闲端口（`detect-port` 或自实现）。默认尝试 3000，被占用则递增。
- 传入 workspace 路径和配置。
- 窗口关闭时停止 server 进程。
- 提供 server 状态（running / stopped / error）。

关键接口：

```ts
startServer(workspacePath: string): Promise<{ port: number; url: string }>
stopServer(): Promise<void>
getServerStatus(): "running" | "stopped" | "error"
detectFreePort(startPort?: number): Promise<number>
```

## 4. `cli-detection.ts` — CLI 可用性检测

职责：

- 检测 `claude` 命令是否可执行（`which` / `where`）。
- 简化策略：Claude Code 可用 → 所有 Agent 类型显示为可用。
- 返回检测状态供 Web UI 消费（通过 IPC）。

关键接口：

```ts
detectClaudeCode(): Promise<CliStatus>
// CliStatus: { available: boolean; path?: string; version?: string }

// 简化逻辑：
// - Claude Code available → codex、opencode 均返回 available
// - Claude Code not found → 全部返回 unavailable
```

检测逻辑（伪代码）：

```ts
async function detectClaudeCode(): Promise<CliStatus> {
  try {
    const result = await exec("claude --version");
    return { available: true, path: "claude", version: result.stdout.trim() };
  } catch {
    return { available: false };
  }
}

// Web UI 消费时：Claude Code OK → 三个 Agent 都可选
async function getAgentAvailability(): Promise<Record<string, boolean>> {
  const claude = await detectClaudeCode();
  return {
    claude: claude.available,
    codex: claude.available,
    opencode: claude.available,
  };
}
```

## 5. `ipc-handlers.ts` — IPC 桥接

职责：

- 将 Main Process 的原生能力通过 IPC 暴露给 Renderer 的 Web UI。
- Renderer 通过 `contextBridge` 暴露的 `desktopApi` 调用（不直接访问 Node.js API）。

注册的 IPC handler：

| 通道 | 方向 | 功能 |
|---|---|---|
| `desktop:select-workspace` | Renderer → Main | 打开原生文件夹选择器，返回路径 |
| `desktop:get-secret` | Renderer → Main | 读取安全存储的密钥 |
| `desktop:set-secret` | Renderer → Main | 写入安全存储的密钥 |
| `desktop:delete-secret` | Renderer → Main | 删除安全存储的密钥 |
| `desktop:show-notification` | Renderer → Main | 触发系统通知 |
| `desktop:get-cli-status` | Renderer → Main | 获取 CLI 可用性 |
| `desktop:get-server-status` | Renderer → Main | 获取 server 运行状态 |

## 6. `preload.ts` — 安全桥接

职责：

- 通过 `contextBridge.exposeInMainWorld` 暴露 `desktopApi` 对象到 Web UI。
- 白名单暴露，不暴露任意 Node.js / Electron API。

```ts
// Renderer 端调用示例
window.desktopApi.selectWorkspace();      // → IPC → 原生文件夹选择器
window.desktopApi.showNotification({...}); // → IPC → Electron Notification
window.desktopApi.getSecret("api-key");    // → IPC → safeStorage
```

## 7. `notification.ts` — 系统通知

职责：

- 封装 Electron Notification API。
- 覆盖场景（详见系统设计 §2.3）：
  - Agent run 完成 / 失败
  - 权限审批请求到达
  - 高风险操作预警
  - 长时间静默恢复

关键接口：

```ts
interface NotificationInput {
  title: string;
  body: string;
  urgency?: "normal" | "critical";
  onClick?: () => void;  // 点击通知 → 聚焦主窗口
}

showNotification(input: NotificationInput): void
```

实现要点：

- Windows：使用 Electron `Notification` 模块，需配置 appUserModelId。
- macOS：通知可携带 `urgency: "critical"`（需 entitlements 授权）。

## 8. `secure-storage.ts` — 安全存储

职责：

- 使用 Electron `safeStorage` API 加密存储敏感数据。
- 存储 API Key、Agent 配置等。
- 禁止写入普通日志。

关键接口：

```ts
setSecret(key: string, value: string): Promise<void>
getSecret(key: string): Promise<string | null>
deleteSecret(key: string): Promise<void>
```

实现要点：

- `safeStorage.encryptString()` → 写入本地文件（`app.getPath("userData")`）。
- 读取时 `safeStorage.decryptString()` 解密。
- 文件权限限制为用户只读。

## 9. `preview-server.ts` — 本地预览服务

职责：

- 在 workspace 目录上启动轻量 HTTP 静态文件 server。
- serve Agent 生成的 HTML、图片、前端构建产物等。
- 仅监听 `127.0.0.1`，仅桌面进程可访问。

关键接口：

```ts
startPreviewServer(workspacePath: string, port?: number): Promise<{ port: number; url: string }>
stopPreviewServer(): Promise<void>
getPreviewUrl(relativePath: string): string
```

实现：

- 使用 `express.static` 或 Node.js 内置 `http` 模块。
- 端口可配置，默认在 Local Backend 端口基础上 +1000。
- Renderer 的 WebPreviewCard 直接加载生成的 URL。

## 10. workspace 选择

职责（分散在 `ipc-handlers.ts` + `preload.ts` + `server-lifecycle.ts` 中协作）：

- 用户创建会话时，Renderer 调用 `desktopApi.selectWorkspace()`。
- Main Process 调用 `dialog.showOpenDialog({ properties: ["openDirectory"] })` 打开原生文件夹选择器。
- 用户选择后返回路径给 Renderer → Renderer 传给 Local Backend → Agent CLI 的 `cwd` 设置为该路径。
- 记录最近 workspace 路径到本地存储，下次默认定位到父目录。

规则：

- 每次创建新会话必须用户显式确认 workspace（与 Web 端行为一致）。
- 不允许默认授权整个用户目录。

## 11. 权限审批

桌面端**不做命令拦截**，只做通知增强：

- 高风险操作到达时，`permission:requested` WS 事件 → Electron 发出系统级通知。
- 用户切回窗口 → 在 Web UI 的 ApprovalPage 中审批（复用现有链路）。
- 不在桌面端另做原生确认弹窗。

审批数据流：

```text
Agent CLI → adapter → permission:requested (WS)
  → Electron Notification（提醒用户）
  → Web UI ApprovalPage 渲染
  → 用户 approve/deny
  → permission:respond (WS)
  → adapter 继续/取消执行
```

## 12. 实现顺序

| 序号 | 模块 | 说明 |
|---|---|---|
| 1 | `index.ts` | Electron shell：窗口创建、加载 Web UI |
| 2 | `server-lifecycle.ts` | 启动/停止 apps/server + 端口探测 |
| 3 | workspace 选择（IPC） | 原生文件夹选择器 + 路径传递 |
| 4 | `preload.ts` + `ipc-handlers.ts` | IPC 桥接框架 |
| 5 | `cli-detection.ts` | Claude Code 可用性检测 |
| 6 | `secure-storage.ts` | 本机密钥加密存储 |
| 7 | `notification.ts` | 系统通知（Agent run 完成 + 权限审批） |
| 8 | `preview-server.ts` | 本地静态文件预览服务 |

