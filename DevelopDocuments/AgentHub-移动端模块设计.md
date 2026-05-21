# AgentHub 移动端模块设计

## 1. 模块边界

```text
apps/mobile
├── pages
│   ├── ConversationListPage
│   ├── ChatPage
│   ├── ArtifactPreviewPage
│   ├── ApprovalPage
│   └── SettingsPage
├── components
│   ├── mobile-chat
│   ├── mobile-agent
│   ├── mobile-artifact
│   └── mobile-run-status
├── stores
├── hooks
└── lib
```

## 2. 页面

### 2.1 `ConversationListPage`

职责：

- 展示会话列表。
- 展示未读、运行中、等待审批状态。
- 支持搜索。

### 2.2 `ChatPage`

职责：

- 展示消息。
- 展示 run/task/tool 状态。
- 支持发送文本。
- 支持 @ Agent。
- 支持停止 run。

### 2.3 `ArtifactPreviewPage`

职责：

- 展示网页预览。
- 展示 Diff 摘要。
- 展示下载信息。

限制：

- 不做完整代码编辑。
- 大文件只显示摘要。

### 2.4 `ApprovalPage`

职责：

- 展示待审批权限请求。
- approve/deny。
- 展示风险说明和命令摘要。

### 2.5 `SettingsPage`

职责：

- 后端地址。
- 通知设置。
- Agent 状态只读查看。

## 3. 组件

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
├── MobileWebPreview.tsx
└── MobileDeployStatus.tsx

components/mobile-agent/
├── MobileAgentAvatar.tsx
├── MobileAgentPicker.tsx
└── MobileAgentStatusBadge.tsx
```

## 4. Stores

```text
stores/
├── mobile-conversation.store.ts
├── mobile-message.store.ts
├── mobile-run.store.ts
├── mobile-artifact.store.ts
└── mobile-ui.store.ts
```

Store 规则：

- 只缓存当前会话和最近会话列表。
- 大型 artifact 按需加载。
- WS 事件和 Web 端使用同一 `ServerEvent` 类型。

## 5. API 使用

复用：

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

## 6. 实现顺序

1. 移动路由和布局
2. 会话列表
3. 聊天页只读消息
4. WS 状态同步
5. 消息发送
6. Run 停止
7. 审批面板
8. Artifact 预览
9. PWA 安装和通知

