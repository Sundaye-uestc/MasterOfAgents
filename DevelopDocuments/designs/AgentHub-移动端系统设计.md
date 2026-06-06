# AgentHub 移动端系统设计

## 1. 定位

移动端用于轻量查看和审批，不承载完整代码编辑体验。

核心能力：

- 查看会话
- 接收 Agent 运行状态
- 查看产物预览
- 停止 run
- 简单回复和 @ Agent

## 2. 技术栈

| 层 | 选型 |
|---|---|
| Mobile Web | PWA 优先 |
| Native App | React Native / Expo 备选 |
| 通信 | REST + WebSocket |
| 状态 | Zustand |
| 推送 | 应用内通知（WebSocket 长连接），不做系统级推送 |

MVP 采用移动 Web/PWA，不单独做原生 App。

## 3. 架构

### 3.1 项目结构

移动端放在现有 monorepo 内，与 web/server 平级：

```
AgentHub/
├── apps/
│   ├── server/   ← @agenthub/server
│   ├── web/      ← @agenthub/web
│   └── mobile/   ← @agenthub/mobile（新增）
├── packages/
│   └── shared/   ← @agenthub/shared（共用 types/schemas）
└── package.json
```

### 3.2 组件复用策略

混合策略——分层复用：

| 层 | 策略 | 说明 |
|---|---|---|
| types / schemas | 直接复用 `@agenthub/shared` | workspace 依赖 |
| API 函数 | 复用 `@agenthub/web` 或抽至 shared | 待定 |
| Zustand stores | 直接复用 | 同一 workspace |
| 叶子 UI 组件 | 加响应式变体，mobile 直接引用 | Badge、CapabilityTags、MarkdownContent 等 |
| 页面级组件 | mobile 独立实现 | ChatArea、ConversationList 等，共享 store 和 API |

### 3.3 应用架构

```text
Mobile Client
├── Conversation List
├── Chat View
├── Run Status View
├── Artifact Preview
├── Approval Panel
└── Settings

Backend
├── existing REST API
├── existing WebSocket
└── notification hooks
```

## 4. 功能范围

| 功能 | MVP |
|---|---|
| 会话列表 | 是 |
| 消息查看 | 是 |
| 发送文本消息 | 是 |
| @ Agent | 是 |
| 流式状态查看 | 是 |
| Diff 查看 | 只读 |
| 网页预览 | 是（新标签页打开，不做内嵌 iframe） |
| apply/revert Diff | 审批型操作：展示 Diff 摘要 + 调用后端 API，移动端不做 Diff 分析 |
| 文件树 | 变更文件列表 + 点击查看文件内容（只读），不渲染 PPT/二进制等复杂格式 |
| 代码编辑器 | 否 |
| Agent 配置编辑 | 否 |

## 5. 交互原则

- 移动端以状态查看和审批为主。
- 大型 Diff 默认折叠。
- 长消息和代码块默认可折叠。
- 运行中任务优先展示当前状态和停止按钮。

## 6. 与 Web 端关系

- 复用 shared types/schemas。
- 可复用部分 chat/artifact 组件，但布局独立。
- 不复用桌面端本机能力。

## 7. 基础设施

| 项 | 决定 | 说明 |
|---|---|---|
| 认证 | 暂不要求 token，直接访问后端 API | MVP 阶段简化，后续按需追加 |
| 构建 | 独立 Vite + `vite-plugin-pwa`，复用 web 端共享模块 | `apps/mobile/` 独立构建，引用 `@agenthub/shared` 和 web 端 API/store |
| 离线 | 不做离线缓存 | 无网络时展示"未连接到网络"提示，阻止进入系统 |

---

## 8. MVP 验收

- [ ] 手机视口可浏览会话列表
- [ ] 可进入会话查看消息
- [ ] 可查看 run/task/tool 状态
- [ ] 可停止 run
- [ ] 可查看网页预览和 Diff 摘要
- [ ] 可发送文本消息和 @ Agent
