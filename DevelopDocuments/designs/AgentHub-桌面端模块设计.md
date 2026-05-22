# AgentHub 桌面端模块设计

## 1. 模块边界

```text
apps/desktop
├── shell
│   ├── window
│   ├── tray
│   ├── menu
│   └── notifications
├── native
│   ├── workspace-dialog
│   ├── secure-storage
│   ├── command-confirmation
│   └── cli-detection
├── bridge
│   ├── ipc-client
│   ├── local-server-client
│   └── desktop-capabilities
└── web
    └── reuse apps/web build
```

## 2. `shell`

职责：

- 创建主窗口。
- 加载 Web UI。
- 管理托盘和菜单。
- 处理窗口关闭策略。
- 触发系统通知。

关键能力：

```ts
showMainWindow(): Promise<void>
hideToTray(): Promise<void>
notify(input: NotificationInput): Promise<void>
```

## 3. `workspace-dialog`

职责：

- 打开系统目录选择器。
- 返回 workspace 根目录。
- 记录最近 workspace。

规则：

- 每次新 workspace 必须用户确认。
- 不允许默认授权整个用户目录。

## 4. `secure-storage`

职责：

- 存储 API Key。
- 存储本地 Agent 配置。
- 提供给本地 server 注入 env。

接口：

```ts
setSecret(name: string, value: string): Promise<void>
getSecret(name: string): Promise<string | null>
deleteSecret(name: string): Promise<void>
```

## 5. `cli-detection`

职责：

- 检测 `claude`、`codex`、`opencode` 是否可执行。
- 获取版本号。
- 生成 Agent 可用状态。

接口：

```ts
detectCli(name: "claude" | "codex" | "opencode"): Promise<CliStatus>
detectAllCli(): Promise<CliStatus[]>
```

## 6. `command-confirmation`

职责：

- 对高风险命令弹窗确认。
- 返回 approve/deny。
- 写审计日志。

高风险命令：

- 删除文件
- 安装依赖
- 外网访问
- 部署
- 执行未知 shell 命令

## 7. `desktop-capabilities`

职责：

- 将桌面能力暴露给 Web UI 或 Local Backend。
- 不直接暴露任意文件系统 API。

能力：

```ts
selectWorkspace()
showNotification()
readSecureSecret()
confirmCommand()
detectAgentCli()
```

## 8. 实现顺序

1. Desktop shell 加载 Web UI
2. 本地 server 启停
3. workspace 选择
4. CLI 检测
5. secure storage
6. 命令确认
7. 系统通知
8. 托盘和窗口生命周期

