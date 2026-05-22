# AgentHub 模块设计

## 1. 模块边界

```text
apps/web
  ├── chat          聊天主界面、消息流、输入框
  ├── agent         Agent 联系人、AgentPicker、状态/能力展示
  ├── artifact      Diff、网页预览、部署卡片、下载卡片
  ├── workspace     文件树、快照、文件变更操作
  ├── stores        Zustand 状态
  └── lib           WS client、API client、事件适配

apps/server
  ├── routes        REST API
  ├── ws            WebSocket 网关
  ├── services      业务服务
  ├── adapters      Agent 平台适配器
  ├── runtime       子进程与流解析
  ├── orchestrator  Planner、DAG 调度、聚合
  ├── db            Drizzle schema、repositories
  └── lib           config、logger、ids、errors

packages/shared
  ├── types         前后端共享类型
  ├── schemas       Zod 校验
  └── constants     常量、事件名、状态枚举
```

## 2. 后端模块

### 2.1 `routes`

职责：

- 定义 REST API。
- 做 request schema 校验。
- 调用 service，不写业务逻辑。

文件：

```text
routes/
├── conversations.route.ts
├── messages.route.ts
├── agents.route.ts
├── runs.route.ts
├── workspaces.route.ts
├── artifacts.route.ts
├── deployments.route.ts
└── secrets.route.ts
```

### 2.2 `ws`

职责：

- 管理 WS 连接。
- 接收 `ClientEvent`。
- 分发 `ServerEvent`。
- 重连后由 REST 补齐状态。

文件：

```text
ws/
├── gateway.ts
├── client-events.ts
├── server-events.ts
└── connection-registry.ts
```

### 2.3 `ChatService`

职责：

- 创建/更新/归档会话。
- 搜索会话。
- 管理会话成员。
- 创建用户消息和 Agent 消息。
- 创建引用回复消息。
- 识别 create_agent intent。
- 处理消息级 Pin。
- 构造 Agent 上下文。

关键方法：

```ts
createConversation(input): Promise<Conversation>
listConversations(): Promise<Conversation[]>
searchConversations(query: string): Promise<Conversation[]>
archiveConversation(id: string, archived: boolean): Promise<void>
addMessage(input): Promise<Message>
replyMessage(input): Promise<Message>
pinMessage(messageId: string, pinned: boolean): Promise<void>
buildContext(conversationId: string): Promise<ChatMessage[]>
```

上下文规则：

- pinned messages 优先注入。
- 其次注入最近 N 条消息。
- 超长时保留 pinned，裁剪普通历史。

### 2.4 `PlannerService`

职责：

- 调用 Planner LLM。
- 生成结构化 `TaskPlan`。
- 校验 JSON schema。
- 失败时返回 direct fallback。

关键方法：

```ts
generateTaskPlan(input: PlannerInput): Promise<TaskPlan | DirectFallback>
validateTaskPlan(plan: unknown): TaskPlan
```

降级规则：

- JSON 解析失败：重试 1 次。
- schema 校验失败：重试 1 次。
- 仍失败：返回单 Agent 直接执行。

### 2.5 `OrchestratorService`

职责：

- 创建 orchestrated run。
- 调用 `PlannerService`。
- 持久化 tasks。
- 按 DAG 调度任务。
- 聚合结果消息。

不负责：

- `create_agent` intent。该路径由 `ChatService` 识别并生成 `AgentConfigDraft`，不走 `TaskPlan`。

关键方法：

```ts
startOrchestratedRun(input): Promise<Run>
scheduleReadyTasks(runId: string): Promise<void>
handleTaskCompleted(taskId: string): Promise<void>
aggregateRun(runId: string): Promise<Message>
```

调度规则：

- 依赖完成后任务进入 ready。
- 写入范围重叠则串行。
- 高风险任务等待用户确认。
- 子任务失败重试 1 次。

### 2.6 `AgentRuntimeService`

职责：

- 创建 direct run 或 task run。
- 选择 Agent Adapter。
- 启动/停止 run。
- 将 `AgentEvent` 归一化并落库。
- 推送 WS 事件。

关键方法：

```ts
startRun(input: StartRunInput): Promise<Run>
stopRun(runId: string): Promise<void>
consumeAgentEvents(run: Run, stream: AsyncIterable<AgentEvent>): Promise<void>
```

事件落库规则：

- `text_delta` 更新 streaming message。
- `tool_call/tool_result` 写 `tool_invocations`。
- `file_change` 写 `file_changes`。
- `artifact_created` 写 `artifacts`。
- `run_completed/run_failed` 更新 `runs.status`。

### 2.7 `ProcessSupervisor`

职责：

- 管理平台 Agent 子进程。
- 解析 stdout stream-json。
- 捕获 stderr。
- 支持 timeout/kill/AbortSignal。
- 控制并发。

关键方法：

```ts
start(spec: ProcessSpec): AsyncIterable<ProcessEvent>
stop(processId: string): Promise<void>
getActiveCount(): number
```

默认限制：

- 最大并发：3。
- 单 run 默认超时：10 分钟。
- stderr 写入 `audit_logs`。

### 2.8 `AgentPlatformAdapter`

职责：

- 屏蔽 Claude Code / Codex / OpenCode 差异。
- 输出统一 `AgentEvent`。
- 不直接操作数据库。

文件：

```text
adapters/
├── base.ts
├── claude-code.adapter.ts
├── codex.adapter.ts
├── opencode.adapter.ts
└── custom-agent.adapter.ts
```

实现顺序：

1. `claude-code.adapter.ts`
2. `opencode.adapter.ts` 或 `codex.adapter.ts`
3. `custom-agent.adapter.ts`

### 2.9 `WorkspaceService`

职责：

- 为 conversation 创建 workspace。
- 生成 before/after snapshot。
- 计算文件 hash manifest。
- 生成 file_changes。
- 应用/回滚 Diff。

关键方法：

```ts
ensureWorkspace(conversationId: string): Promise<Workspace>
createSnapshot(workspaceId: string, runId: string, label: string): Promise<WorkspaceSnapshot>
diffSnapshots(beforeId: string, afterId: string): Promise<FileChange[]>
applyFileChange(fileChangeId: string): Promise<void>
revertFileChange(fileChangeId: string): Promise<void>
```

### 2.10 `ArtifactService`

职责：

- 从文件变更或输出目录创建 artifact。
- 提供预览 URL。
- 提供下载。

Artifact 类型：

- `file`
- `diff`
- `webpage`
- `archive`
- `deployment`

### 2.11 `DeployService`

职责：

- 本地静态预览。
- workspace 打包下载。
- 写 deployment 状态。
- 推送部署状态事件。

MVP 只做：

- `zip` 下载。
- `local-static` 预览。

### 2.12 `SecurityService`

职责：

- secrets 加密存储。
- 权限请求创建/审批。
- 命令风险判断。
- 审计日志。

策略：

- `deploy` 必须确认。
- 高风险命令必须确认。
- secret 不写入消息、日志、tool result。

## 3. 前端模块

### 3.1 `chat`

职责：

- 会话列表。
- 对话搜索。
- 消息流。
- 消息输入。
- 流式消息更新。
- 消息 Pin。
- 引用回复。
- 消息重新生成。

组件：

```text
components/chat/
├── ConversationList.tsx
├── ConversationSearchBar.tsx
├── ChatArea.tsx
├── MessageList.tsx
├── MessageBubble.tsx
├── MessageInput.tsx
├── ReplyPreviewCard.tsx
├── PinnedMessageBar.tsx
└── OrchestratorStatusBar.tsx
```

交互：

- `MessageBubble` 提供 ReplyButton、RegenerateButton。
- `MessageInput` 保存 `replyTarget`，展示正在回复的缩略卡片。
- `ConversationList` 顶部展示 `ConversationSearchBar`。

### 3.2 `agent`

职责：

- Agent 联系人展示。
- AgentPicker。
- 能力标签。
- 可用状态。
- 自建 Agent 确认卡片。

组件：

```text
components/agent/
├── AgentPicker.tsx
├── AgentContactList.tsx
├── AgentStatusBadge.tsx
├── CapabilityTags.tsx
└── AgentConfigDraftCard.tsx
```

### 3.3 `artifact`

职责：

- Diff 展示。
- 网页 iframe 预览。
- 部署状态。
- 下载卡片。

组件：

```text
components/artifact/
├── ArtifactCard.tsx
├── DiffCard.tsx
├── WebPreviewCard.tsx
├── DeployStatusCard.tsx
└── DownloadCard.tsx
```

### 3.4 `workspace`

职责：

- 文件树。
- 快照列表。
- 文件变更列表。
- apply/revert 操作。

组件：

```text
components/workspace/
├── FileTree.tsx
├── SnapshotList.tsx
├── FileChangeList.tsx
└── WorkspacePanel.tsx
```

### 3.5 `stores`

```text
stores/
├── conversation.store.ts
├── message.store.ts
├── agent.store.ts
├── run.store.ts
├── artifact.store.ts
├── workspace.store.ts
└── ui.store.ts
```

Store 边界：

- `conversation.store`: conversations、activeConversationId、searchQuery、archivedFilter
- `message.store`: messagesByConversation、streaming messages、replyTarget
- `agent.store`: agents、availability、capability filters
- `run.store`: active runs、tasks、tool invocations
- `artifact.store`: artifacts、deployments
- `workspace.store`: files、snapshots、fileChanges
- `ui.store`: panels、dialogs、selection

### 3.6 `lib`

```text
lib/
├── api-client.ts
├── ws-client.ts
├── event-dispatcher.ts
└── optimistic-updates.ts
```

职责：

- REST 请求封装。
- WS 连接和重连。
- ServerEvent 分发到 stores。
- 乐观更新和失败回滚。

## 4. 共享包

```text
packages/shared/src/
├── types/
│   ├── agent.ts
│   ├── conversation.ts
│   ├── message.ts
│   ├── run.ts
│   ├── task.ts
│   ├── artifact.ts
│   ├── workspace.ts
│   └── ws-events.ts
├── schemas/
│   ├── agent.schema.ts
│   ├── message.schema.ts
│   ├── task-plan.schema.ts
│   └── ws-event.schema.ts
└── constants.ts
```

规则：

- 前后端共享类型从 `packages/shared` 导入。
- REST body 和 WS event 必须用 Zod schema 校验。
- DB schema 不放 shared，放 server/db。

## 5. 核心链路

### 5.1 单聊消息

```text
MessageInput
→ POST /api/conversations/:id/messages
→ ChatService.addMessage
→ AgentRuntimeService.startRun
→ Adapter.run
→ AgentEvent
→ DB update
→ WS ServerEvent
→ stores update
→ MessageBubble streaming
```

### 5.2 群聊消息

```text
MessageInput
→ ChatService.addMessage
→ OrchestratorService.startOrchestratedRun
→ PlannerService.generateTaskPlan
→ tasks persisted
→ DAG Scheduler
→ AgentRuntimeService.startRun per task
→ Aggregator summary
→ WS updates
```

### 5.3 文件变更

```text
Run starts
→ WorkspaceService.createSnapshot(before)
→ Agent modifies files
→ WorkspaceService.createSnapshot(after)
→ WorkspaceService.diffSnapshots
→ file_changes
→ ArtifactService.createDiffArtifact
→ WS artifact:created
```

### 5.4 自建 Agent

```text
User asks to create agent
→ ChatService detects create_agent intent
→ LLM generates AgentConfigDraft
→ AgentConfigDraftCard
→ user confirms
→ POST /api/agents
→ agent.store.addAgent
→ AgentPicker shows new Agent
```

## 6. 实现顺序

1. `packages/shared` types/schemas
2. `server/db` schema/repositories
3. `ProcessSupervisor`
4. `ClaudeCodeAdapter`
5. `AgentRuntimeService`
6. `ChatService`
7. WS gateway
8. Web chat shell
9. Conversation search/archive
10. Reply/regenerate UI
11. Workspace snapshots/file changes
12. Artifact cards
13. PlannerService
14. OrchestratorService
15. AgentPicker/status/capabilities
16. Custom Agent flow
17. Deploy/download
