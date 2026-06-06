# AgentHub 移动端模块设计

## 1. 模块边界

```
AgentHub/
├── apps/
│   ├── server/
│   ├── web/
│   └── mobile/       ← 新增，@agenthub/mobile
├── packages/
│   └── shared/       ← 复用 @agenthub/shared
└── package.json
```

```
apps/mobile
├── pages
│   ├── ConversationListPage
│   ├── ChatPage
│   ├── ArtifactPreviewPage
│   ├── ApprovalPage
│   └── SettingsPage
├── components
│   ├── mobile-chat
│   ├── mobile-artifact
│   └── mobile-run-status
├── stores
├── hooks
└── lib
```

## 2. 复用策略

混合分层复用：

| 层 | 策略 | 说明 |
|---|---|---|
| types / schemas | 直接复用 `@agenthub/shared` | workspace 依赖 |
| API 函数 | 直接复用 `@agenthub/web` 的 `api.ts` | 同一 workspace |
| Zustand stores | 直接复用 web 端 stores | 仅新增 `mobile-ui.store.ts` 管理移动端特有 UI 状态 |
| 叶子 UI 组件 | web 端组件加响应式变体，mobile 直接引用 | Badge、CapabilityTags、MarkdownContent 等 |
| 页面级组件 | mobile 独立实现 | ChatArea、ConversationList 等，共享 store 和 API |

**不复用**：桌面端本机能力（文件系统操作、终端、桌面通知等）。

## 3. 页面

### 3.1 `ConversationListPage`

职责：

- 展示会话列表。
- 展示未读、运行中、等待审批状态。
- 支持搜索。

### 3.2 `ChatPage`

职责：

- 展示消息。
- 展示 run/task/tool 状态。
- 支持发送文本。
- 支持 @ Agent。
- 支持停止 run。

### 3.3 `ArtifactPreviewPage`

职责：

- 展示网页预览（点击后新标签页打开，不做内嵌 iframe）。
- 展示 Diff 摘要（只读，大型 Diff 默认折叠）。
- 展示下载信息。
- 展示变更文件列表 + 点击查看文件内容（只读），不渲染 PPT/二进制等复杂格式。

限制：

- 不做完整代码编辑。
- 大文件只显示摘要。

### 3.4 `ApprovalPage`

职责：

- 展示待审批权限请求（permission:required）。
- approve / deny。
- 展示风险说明和命令摘要。
- Diff apply / revert 审批：展示 Diff 摘要 + 调用后端 API，移动端不做 Diff 分析。

### 3.5 `SettingsPage`

职责：

- 后端地址。
- 通知设置（应用内通知，WS 长连接）。
- Agent 状态只读查看。

## 4. 组件

### 4.1 复用 Web 端组件（加响应式变体）

| 组件 | 来源 | 说明 |
|------|------|------|
| AgentBadge | `@agenthub/web` | 已有 sm/md/lg 尺寸，移动端用 sm |
| GroupAvatar | `@agenthub/web` | 复用 |
| CapabilityTags | `@agenthub/web` | 复用 `formatCapability()` |
| MarkdownContent | `@agenthub/web` | 复用，长内容可折叠 |
| AgentPicker | `@agenthub/web` | 复用 |
| AgentStatusBadge | `@agenthub/web` | 复用 |

### 4.2 移动端独立组件

```text
components/mobile-chat/
├── MobileMessageList.tsx
├── MobileMessageBubble.tsx
├── MobileMessageInput.tsx
├── MobilePinnedContext.tsx
└── MobileMentionPicker.tsx

components/mobile-run-status/
├── RunStatusBanner.tsx
├── TaskProgressList.tsx
├── ToolInvocationList.tsx
└── StopRunButton.tsx

components/mobile-artifact/
├── MobileArtifactCard.tsx
├── MobileDiffSummary.tsx
├── MobileWebPreviewLink.tsx
├── MobileFileViewer.tsx
└── MobileDeployStatus.tsx
```

## 5. Stores

直接复用 web 端 stores，仅新增移动端特有 store：

```text
stores/
└── mobile-ui.store.ts    ← 移动端特有（视口状态、当前页面、网络状态）
```

复用（来自 `@agenthub/web`）：

```
conversation.store.ts
message.store.ts
agent.store.ts
run.store.ts
artifact.store.ts
```

Store 规则：

- 只缓存当前会话和最近会话列表。
- 大型 artifact 按需加载。
- WS 事件和 Web 端使用同一 `ServerEvent` 类型。

## 6. API 使用

复用现有 REST + WebSocket，同 `@agenthub/web` 的 `api.ts`：

```http
GET    /api/conversations
GET    /api/conversations/:id/messages
POST   /api/conversations/:id/messages
GET    /api/runs/:id
POST   /api/runs/:id/stop
POST   /api/file-changes/:id/apply
POST   /api/file-changes/:id/revert
GET    /api/artifacts/:id
```

移动端重点 WS 事件：

```ts
run:status
task:status
agent:tool_call
agent:tool_result
permission:required
artifact:created
deploy:status
message:delta
```

## 7. 基础设施

| 项 | 决定 | 说明 |
|---|---|---|
| 认证 | 暂不要求 token，直接访问后端 API | MVP 阶段简化，后续按需追加 |
| 构建 | 独立 Vite + `vite-plugin-pwa`，复用 web 端共享模块 | `apps/mobile/` 独立构建，引用 `@agenthub/shared` 和 web 端 API/store |
| 离线 | 不做离线缓存 | 无网络时展示"未连接到网络"提示，阻止进入系统 |
| 推送 | 应用内通知（WebSocket 长连接） | 不做系统级推送 |

## 8. 实现顺序

1. 移动路由和布局 + 网络检测页
2. 会话列表
3. 聊天页只读消息
4. WS 状态同步
5. 消息发送
6. Run 停止
7. 审批面板（权限审批 + Diff apply/revert）
8. Artifact 预览（网页链接、Diff 摘要、文件查看）
9. 移动端适配收尾（响应式、触摸交互、安全区域）
