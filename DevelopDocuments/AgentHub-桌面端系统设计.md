# AgentHub 桌面端系统设计

## 1. 定位

桌面端用于增强 Web 端无法稳定覆盖的本机能力：

- 本地 workspace 选择与文件访问
- 本地 Agent CLI/SDK 进程管理
- 系统通知
- 本地预览服务
- 本机密钥存储

桌面端不是 Web 端的替代品。MVP 可先用 Web UI + Desktop Shell 承载同一前端。

## 2. 技术栈

| 层 | 选型 |
|---|---|
| Desktop Shell | Tauri 优先，Electron 备选 |
| UI | 复用 `apps/web` |
| Backend Bridge | 本地 Node.js server 或 Tauri command |
| 本地存储 | SQLite + Local FS |
| 进程管理 | Node child_process 或 Tauri sidecar |
| 通信 | WebSocket / IPC |

## 3. 架构

```text
AgentHub Desktop
├── Desktop Shell
│   ├── window management
│   ├── native dialogs
│   ├── notifications
│   └── secure storage
├── Web UI
│   └── reuse apps/web
├── Local Backend
│   ├── same apps/server if bundled
│   ├── Agent Runtime
│   ├── ProcessSupervisor
│   └── WorkspaceService
└── Platform Agent Processes
    ├── claude
    ├── codex
    └── opencode
```

## 4. 运行模式

| 模式 | 说明 |
|---|---|
| Bundled Local | 桌面端启动内置 server，UI 连接 `localhost` |
| Remote Backend | 桌面端只提供本机桥接能力，主服务仍在远端 |
| Hybrid | 默认使用本地 runtime，数据可连接远端后端 |

MVP 采用 `Bundled Local`。

## 5. 安全边界

- 用户必须显式选择 workspace 根目录。
- Agent 只能访问已授权 workspace。
- 高风险命令弹出原生确认。
- secret 存入系统安全存储，禁止写入普通日志。
- 桌面端暴露本地 server 时只监听 `127.0.0.1`。

## 6. 与 Web 端关系

- UI 复用 `apps/web`。
- shared types/schemas 复用 `packages/shared`。
- 桌面端新增 native capabilities，不改变 Web 核心协议。

## 7. MVP 验收

- [ ] 桌面端可打开 Web UI
- [ ] 可选择本地 workspace
- [ ] 可检测 Claude Code/Codex/OpenCode CLI 是否可用
- [ ] 可启动本地 Agent run
- [ ] 可收到系统通知
- [ ] 关闭窗口后能停止或保留本地 run，行为明确

