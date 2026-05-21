# AgentHub 移动端系统设计

## 1. 定位

移动端用于轻量查看和审批，不承载完整代码编辑体验。

核心能力：

- 查看会话
- 接收 Agent 运行状态
- 查看产物预览
- 审批高风险操作
- 停止 run
- 简单回复和 @ Agent

## 2. 技术栈

| 层 | 选型 |
|---|---|
| Mobile Web | PWA 优先 |
| Native App | React Native / Expo 备选 |
| 通信 | REST + WebSocket |
| 状态 | Zustand |
| 推送 | Web Push / Native Push 后续 |

MVP 采用移动 Web/PWA，不单独做原生 App。

## 3. 架构

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
| 网页预览 | 是 |
| apply/revert Diff | 审批型操作 |
| 部署审批 | 是 |
| 文件树 | 简化 |
| 代码编辑器 | 否 |
| Agent 配置编辑 | 否 |

## 5. 交互原则

- 移动端以状态查看和审批为主。
- 大型 Diff 默认折叠。
- 高风险操作使用底部确认面板。
- 长消息和代码块默认可折叠。
- 运行中任务优先展示当前状态和停止按钮。

## 6. 与 Web 端关系

- 复用 shared types/schemas。
- 可复用部分 chat/artifact 组件，但布局独立。
- 不复用桌面端本机能力。

## 7. MVP 验收

- [ ] 手机视口可浏览会话列表
- [ ] 可进入会话查看消息
- [ ] 可查看 run/task/tool 状态
- [ ] 可审批 `permission_required`
- [ ] 可停止 run
- [ ] 可查看网页预览和 Diff 摘要
- [ ] 可发送文本消息和 @ Agent

