# AgentHub 技术规格书

**更新时间 · 2026-06-09**

本文档基于项目最终交付状态，描述 AgentHub 的完整技术规格。不包含设计意图或开发过程——只描述"是什么"（What）和"怎么工作"（How）。

---

## 一、系统架构

### 1.1 总览

```
┌─────────────────────────────────────────────────────┐
│  Web (Vite :5173)   Mobile (Vite :5174)             │  ← React 19 + Tailwind 4 + Zustand
│  Desktop (Electron 33)                              │
└────────────┬────────────────────────────────────────┘
             │  REST (:3001) + WebSocket (:3001/ws)
┌────────────┴────────────────────────────────────────┐
│  Server (Hono + ws + drizzle-orm)                   │
│                                                     │
│  Routes ──▶ Services ──▶ Adapters (CLI subprocess) │
│                     │                               │
│                     └──▶ SQLite (sql.js)           │
└─────────────────────────────────────────────────────┘
```

### 1.2 技术栈

| 层 | 选型 | 版本 |
|---|---|---|
| Web | React + Vite + Tailwind CSS | React 19 / Vite 6 / Tailwind 4 |
| Mobile | React + Vite (PWA) + Tailwind CSS | 同上，复用 Web stores/API/hooks |
| Desktop | Electron | 33 |
| Server | Node.js + TypeScript + Hono | Hono 4.6 |
| DB | SQLite (sql.js) + Drizzle ORM | Drizzle 0.45 |
| Agent Runtime | CLI 子进程 (`claude` / `codex` / `opencode`) | stdin → `--output-format stream-json` → stdout |
| Planner LLM | 8 个 Provider 可切换 | anthropic / deepseek / dashscope / openai / moonshot / openrouter / glm / dobrain |
| 实时通信 | ws (WebSocket) | ws 8.20 |
| 状态管理（前端） | Zustand | 5.x |
| 代码编辑器 | @monaco-editor/react (lazy) | 5MB gzip~1.5MB |
| PPT 渲染 | pptxviewjs (Canvas) | 3.x |
| 构建（桌面） | electron-builder `--dir` | 25.x |

### 1.3 顶层目录结构

```text
AgentHub/
├── apps/
│   ├── server/src/         Hono 后端
│   │   ├── routes/         8 个路由模块
│   │   ├── services/       8 个业务服务
│   │   ├── adapters/       Claude Code / Codex 适配器
│   │   ├── runtime/        进程监控 + 流解析
│   │   ├── ws/             WebSocket 网关 + 连接注册表
│   │   ├── db/             Drizzle schema + seed
│   │   └── lib/            config / ids / errors
│   ├── web/src/            React Web 前端
│   │   ├── components/     chat / artifact / agent / workspace
│   │   ├── stores/         7 个 Zustand store
│   │   ├── hooks/          useWebSocket
│   │   └── lib/            api client
│   ├── mobile/src/         React PWA 移动端
│   │   ├── pages/          5 个页面
│   │   ├── components/     移动端组件
│   │   ├── stores/         mobile-ui.store
│   │   └── hooks/          useNetworkStatus
│   └── desktop/src/        Electron
│       ├── main/           server-lifecycle / ipc / cli-detection / preview-server / notification
│       └── preload/        contextBridge
├── packages/shared/        共享类型 + 常量 + schema
└── ppt/                    Python PPT 生成 + 预览转换脚本
```

---

## 二、数据模型

### 2.1 实体关系

```
conversations 1──N messages
conversations 1──N conversation_members N──1 agents
conversations 1──N runs
runs         1──N tasks
runs         1──N tool_invocations
runs         1──N file_changes
runs         1──N artifacts
runs         1──N audit_logs
conversations 1──1 workspaces
workspaces   1──N workspace_snapshots
artifacts    1──N deployments
(独立)       user_profile
(独立)       secrets
```

### 2.2 表结构

**conversations** — 会话

| column | type | note |
|---|---|---|
| id | TEXT PK | UUID |
| title | TEXT | 对话标题 |
| type | TEXT | `direct` \| `group` |
| status | TEXT | `active` \| `archived` |
| pinned_at | TEXT | ISO 时间戳 |
| created_at | TEXT | |
| updated_at | TEXT | |

**conversation_members** — 群聊成员

| column | type | note |
|---|---|---|
| id | TEXT PK | |
| conversation_id | TEXT FK | → conversations.id |
| agent_id | TEXT | → agents.id |
| role | TEXT | `participant` \| `observer` |
| auto_reply | INTEGER | 0/1 |
| joined_at | TEXT | |

**agents** — Agent 定义

| column | type | note |
|---|---|---|
| id | TEXT PK | |
| name | TEXT | |
| slug | TEXT UNIQUE | |
| avatar | TEXT | base64 data URI |
| adapter_kind | TEXT | `claude-code` \| `codex` \| `opencode` \| `custom` |
| config_json | TEXT | `{ systemPrompt, toolSetIds }` |
| capabilities_json | TEXT | `["frontend", "debug"]` |
| status | TEXT | `online` \| `offline` \| `busy` \| `error` |
| is_custom | INTEGER | 0=内置 1=自建 |
| enabled | INTEGER | 0/1 |

**messages** — 消息

| column | type | note |
|---|---|---|
| id | TEXT PK | |
| conversation_id | TEXT FK | |
| run_id | TEXT | 关联 run |
| task_id | TEXT | 关联 task |
| agent_id | TEXT | |
| reply_to_id | TEXT | |
| role | TEXT | `user` \| `agent` \| `system` \| `tool` |
| content | TEXT | Markdown |
| segments_json | TEXT | 结构化内容分段 |
| status | TEXT | `sending` \| `sent` \| `streaming` \| `error` |
| metadata_json | TEXT | `{ pinned, edited }` |

**runs** — 运行记录

| column | type | note |
|---|---|---|
| id | TEXT PK | |
| conversation_id | TEXT FK | |
| trigger_message_id | TEXT | |
| mode | TEXT | `direct` \| `orchestrated` |
| status | TEXT | `queued` \| `running` \| `completed` \| `failed` \| `cancelled` \| `waiting_permission` |
| plan_json | TEXT | TaskPlan JSON |
| planner_model | TEXT | |
| error_json | TEXT | |
| started_at | TEXT | |
| completed_at | TEXT | |

**tasks** — 编排子任务

| column | type | note |
|---|---|---|
| id | TEXT PK | |
| run_id | TEXT FK | → runs.id |
| agent_id | TEXT | |
| title | TEXT | |
| description | TEXT | |
| dependencies_json | TEXT | `["task-1-id", "task-2-id"]` |
| status | TEXT | `queued` \| `running` \| `completed` \| `blocked` \| `failed` \| `skipped` |
| expected_output | TEXT | |
| result_summary | TEXT | |

**tool_invocations** — 工具调用记录

| column | type |
|---|---|
| id | TEXT PK |
| run_id | TEXT FK |
| task_id | TEXT |
| agent_id | TEXT |
| tool_name | TEXT |
| input_json | TEXT |
| output_json | TEXT |
| status | TEXT (`running` \| `success` \| `error`) |
| started_at | TEXT |
| completed_at | TEXT |

**workspaces** — 工作区

| column | type |
|---|---|
| id | TEXT PK |
| conversation_id | TEXT FK |
| root_path | TEXT (本地绝对路径) |
| status | TEXT (`active`) |
| created_at | TEXT |

**workspace_snapshots** — 快照

| column | type | note |
|---|---|---|
| id | TEXT PK | |
| workspace_id | TEXT FK | |
| run_id | TEXT | 关联 run |
| label | TEXT | |
| manifest_json | TEXT | `{ "relative/path": { hash, size } }` |
| created_at | TEXT | |

**file_changes** — 文件变更

| column | type |
|---|---|
| id | TEXT PK |
| run_id | TEXT FK |
| task_id | TEXT |
| path | TEXT (相对路径) |
| change_type | TEXT (`create` \| `modify` \| `delete`) |
| before_hash | TEXT |
| after_hash | TEXT |
| diff | TEXT (unified diff) |
| status | TEXT (`pending` \| `applied` \| `reverted`) |
| created_at | TEXT |

**artifacts** — 产物

| column | type | note |
|---|---|---|
| id | TEXT PK | |
| run_id | TEXT | |
| message_id | TEXT | |
| type | TEXT | `file` \| `diff` \| `webpage` \| `archive` \| `slideshow` |
| name | TEXT | |
| path | TEXT | |
| mime_type | TEXT | |
| size | INTEGER | |
| preview_url | TEXT | `/api/artifacts/static/:id/:filename` |
| metadata_json | TEXT | |

**user_profile** — 用户资料（单行，id="default"）

| column | type |
|---|---|
| id | TEXT PK (= "default") |
| avatar | TEXT (base64 data URI) |
| updated_at | TEXT |

**secrets** / **audit_logs** / **deployments** — 辅助表，字段见 schema.ts

---

## 三、REST API

Base: `/api`。所有响应 `Content-Type: application/json`。

### 3.1 Conversations — `/api/conversations`

| method | path | request | response |
|---|---|---|---|
| GET | `/` | `?q=` (optional) | `ConversationRow[]` |
| GET | `/agents-map` | — | `{ [convId]: { agentId, agentName, adapterKind, avatar } }` |
| POST | `/` | `{ title, type?, agentId?, agentIds?, rootPath? }` | `ConversationRow` (201) |
| GET | `/:id` | — | `ConversationRow` |
| DELETE | `/:id` | — | `{ ok }` |
| PATCH | `/:id/rename` | `{ title }` | `{ ok }` |
| PATCH | `/:id/pin` | `{ pinned }` | `{ ok }` |
| PATCH | `/:id/archive` | — | `{ ok }` |
| PATCH | `/:id/unarchive` | — | `{ ok }` |
| GET | `/:id/agent` | — | `{ agentId }` |

### 3.2 Members — `/api/conversations/:id/members`

| method | path | request | response |
|---|---|---|---|
| GET | `/:id/members` | — | `[{ agentId, agentName, role, adapterKind, avatar }]` |
| POST | `/:id/members` | `{ agentId, role? }` | `MemberRow` (201) |
| DELETE | `/:id/members/:agentId` | — | `{ ok }` |

### 3.3 Messages — `/api/conversations/:id/messages`

| method | path | request | response |
|---|---|---|---|
| GET | `/:id/messages` | — | `MessageRow[]` |
| POST | `/:id/messages` | `{ content, replyToId?, agentId? }` | `{ userMessage, runId, agentMessageId?, plan?, mode? }` (201) |
| PATCH | `/messages/:id/pin` | `{ pinned }` | `{ ok }` |
| GET | `/:id/pinned-messages` | — | `MessageRow[]` |
| DELETE | `/messages/:id` | — | `{ ok }` |
| POST | `/messages/:id/retry` | — | `{ runId, agentMessageId }` (201) |

### 3.4 Agents — `/api/agents`

| method | path | request | response |
|---|---|---|---|
| GET | `/` | `?enabled=true\|false` (optional) | `AgentRow[]` |
| POST | `/` | `{ name, adapterKind, capabilities?, systemPrompt?, toolSetIds? }` | `AgentRow` (201) |
| POST | `/from-draft` | `{ name, platform?, capabilities?, systemPrompt?, toolSetIds? }` | `AgentRow` (201) |
| POST | `/parse-intent` | `{ description }` | `ParsedAgentIntent` (LLM) |
| POST | `/polish-prompt` | `{ draft }` | `PolishPromptResponse` (LLM) |
| GET | `/:id` | — | `AgentRow` |
| PATCH | `/:id` | `{ name?, enabled?, systemPrompt?, capabilities?, toolSetIds?, avatar?, status? }` | `AgentRow` |
| DELETE | `/:id` | — | `{ ok }` (仅自建 Agent) |

### 3.5 Runs — `/api/runs`

| method | path | request | response |
|---|---|---|---|
| GET | `/` | — | `RunRow[]` (active only) |
| GET | `/:id` | — | `RunRow` |
| POST | `/:id/stop` | — | `{ ok }` |
| GET | `/:id/tools` | — | `ToolInvocationRow[]` |
| GET | `/:id/files` | — | `FileChangeRow[]` |

### 3.6 Workspaces — `/api/workspaces`

| method | path | request | response |
|---|---|---|---|
| GET | `/` | `?conversationId=` | `WorkspaceRow \| null` |
| GET | `/browse` | `?path=` | `FileNode[]` |
| GET | `/:id` | — | `WorkspaceRow` |
| POST | `/` | `{ conversationId, rootPath }` | `WorkspaceRow` (201) |
| PATCH | `/:id` | `{ rootPath? }` | `WorkspaceRow` |
| DELETE | `/:id` | — | `{ ok }` |
| GET | `/:id/files` | — | `FileNode[]` |
| GET | `/:id/file-content` | `?path=` | `{ text, isBinary, size, notFound? }` |
| PUT | `/:id/file-content` | `?path=` + body `{ content }` | `{ ok }` |
| GET | `/:id/snapshots` | — | `WorkspaceSnapshotRow[]` |
| GET | `/:id/snapshots/:sid` | — | `WorkspaceSnapshotRow` |
| POST | `/:id/snapshots` | `{ runId, label, manifest }` | `WorkspaceSnapshotRow` (201) |
| POST | `/:id/snapshots/:sid/rollback` | — | `{ ok }` |
| DELETE | `/:id/snapshots/:sid` | — | `{ ok }` |

### 3.7 File Changes — `/api/file-changes`

| method | path | request | response |
|---|---|---|---|
| GET | `/:id` | — | `FileChangeRow` |
| GET | `/by-run/:runId` | — | `FileChangeRow[]` |
| GET | `/by-conversation/:conversationId` | — | `FileChangeRow[]` |
| POST | `/:id/apply` | — | `FileChangeRow` |
| POST | `/:id/revert` | — | `FileChangeRow` |

### 3.8 Artifacts — `/api/artifacts`

| method | path | request | response |
|---|---|---|---|
| GET | `/:id` | — | `ArtifactRow` |
| GET | `/by-run/:runId` | — | `ArtifactRow[]` |
| GET | `/by-conversation/:conversationId` | — | `ArtifactRow[]` |
| POST | `/` | `{ runId, type, name, filePath?, mimeType?, size?, metadata?, rootPath? }` | `ArtifactRow` (201) |
| POST | `/:id/deploy` | `{ target? }` | `{ ok, previewUrl }` |
| GET | `/static/:id/:filename` | — | 静态文件 (binary) |

### 3.9 Profile — `/api/profile`

| method | path | request | response |
|---|---|---|---|
| GET | `/` | — | `{ avatar }` |
| PUT | `/` | `{ avatar? }` | `{ avatar }` |

---

## 四、WebSocket 协议

### 4.1 连接

```
ws://localhost:3001/ws
```

### 4.2 Client → Server

| type | payload | 说明 |
|---|---|---|
| `join:conversation` | `{ conversationId }` | 加入房间 |
| `leave:conversation` | `{ conversationId }` | 离开房间 |
| `typing` | `{ conversationId }` | 正在输入 |
| `cancel:run` | `{ runId }` | 取消运行 |
| `permission:respond` | `{ runId, permissionId, approved }` | 权限审批响应 |

### 4.3 Server → Client

| type | payload | 触发时机 |
|---|---|---|
| `joined` | `{ conversationId }` | join:conversation 响应 |
| `message:created` | `{ message }` | 新消息持久化后 |
| `message:delta` | `{ messageId, delta }` | Agent 流式输出每个 token |
| `message:completed` | `{ messageId }` | Agent 消息完成 |
| `run:started` | `{ runId }` | |
| `run:completed` | `{ runId }` | |
| `run:failed` | `{ runId, error }` | |
| `run:status` | `{ runId, status, progress? }` | |
| `task:started` | `{ runId, taskId, agentId }` | 编排子任务启动 |
| `task:completed` | `{ runId, taskId, resultSummary }` | |
| `task:failed` | `{ runId, taskId, error }` | |
| `orchestrator:plan_created` | `{ runId, plan }` | Planner 生成计划后 |
| `orchestrator:confirmation_needed` | `{ runId, taskId, taskTitle }` | |
| `tool:invocation` | `{ messageId, invocation }` | Agent 调用工具 |
| `file:changed` | `{ change, conversationId }` | |
| `artifact:created` | `{ artifact }` | |
| `deploy:status` | `{ deployment }` | |
| `permission:requested` | `{ permission }` | Agent 请求权限 |
| `typing` | `{ conversationId }` | |

---

## 五、Agent 适配器

### 5.1 统一接口 (`base.ts`)

```typescript
interface AgentPlatformAdapter {
  readonly platform: string;
  prepare(agent: AgentConfig): Promise<void>;
  run(input: RunInput): AsyncIterable<AgentEvent>;
  stop(runId: string): Promise<void>;
  dispose(): Promise<void>;
}

interface RunInput {
  runId: string;
  agentId: string;
  prompt: string;
  systemPrompt?: string;
  messageHistory?: Array<{ role, content }>;  // 短期记忆
  workingDir?: string;
  signal?: AbortSignal;
}
```

### 5.2 统一事件流 (`AgentEvent`)

所有适配器输出规范化为 10 种 `AgentEvent` 类型：

| type | 说明 |
|---|---|
| `run_started` | 运行开始 |
| `run_completed` | 运行成功完成 |
| `run_failed` | 运行失败 |
| `text_delta` | 流式文本增量 |
| `tool_call` | 工具调用开始 |
| `tool_result` | 工具调用结果 |
| `file_change` | 文件变更通知 |
| `artifact_created` | 产物创建通知 |
| `permission_request` | 权限请求 |
| `log` | 原始日志 |

### 5.3 平台适配器

**ClaudeCodeAdapter** — `claude` CLI 子进程，参数：
```
claude --output-format stream-json --system-prompt <prompt> --max-turns 100 -p "<user>"
```
工作目录设为 workspace rootPath。stdout 逐行解析为 AgentEvent。

**CodexAdapter** — 尝试 `codex` / `opencode` CLI。prepare() 失败时**静默降级为 ClaudeCodeAdapter**。

### 5.4 进程管理 (`ProcessSupervisor`)

```
- MAX_CONCURRENT_PROCESSES = 3
- DEFAULT_RUN_TIMEOUT_MS = 600,000 (10 min)
- 空闲看门狗：3 分钟无 stdout → 合成 run_completed 事件并强杀进程
- Windows: 用 taskkill /PID /T /F 终止进程树（不支持 SIGTERM）
- Unix:   SIGTERM → 5s → SIGKILL
```

---

## 六、核心业务流程

### 6.1 单聊（Direct Run）

```
User sends message
  → POST /conversations/:id/messages
  → ChatService.createMessage(role="user")
  → AgentRuntimeService.startDirectRun()
    → ChatService.buildAgentContext()   ← 从 DB 加载历史（max 4000 chars）
    → adapter.prepare(agentConfig)
    → adapter.run(input)
      → ProcessSupervisor spawn CLI
      → stream-json-parser 逐个解析
    → onEvent callback:
      → text_delta → ChatService.appendContent()
      → broadcastToConversation("message:delta")
      → tool_call    → broadcastToConversation("tool:invocation")
      → file_change  → WorkspaceService.diffSnapshots()
      → artifact_created → ArtifactService.createArtifact() + publish preview
      → run_completed → broadcastToConversation("message:completed")
```

### 6.2 群聊（Orchestrated Run）

```
User sends message in group chat
  → POST /conversations/:id/messages
  → 检测 conv.type === "group" && members.length > 1
  → OrchestratorService.startOrchestratedRun()
    → PlannerService.generatePlan()
      → 发送 prompt + agent 列表 + 对话历史 → LLM
      → 解析 JSON → TaskPlan (含 DAG 依赖)
      → 解析失败 → degradedPlan (单 Agent 直发)
      → 闲聊识别 → 每个 Agent 回复任务（无代码）
    → 按 DAG 调度执行：
      → 依赖完成 → 下一个 task
      → AgentRuntimeService.startDirectRun() 执行每个 task
      → Task 的 Agent 只能看到自己的 description + 用户原始 prompt
    → 全部完成 → 聚合结果
```

### 6.3 Agent 上下文窗口

```
buildAgentContext():
  1. 从 DB 加载全部消息
  2. 过滤 role="system" && runId 非空的消息（编排系统内部消息，防止泄露）
  3. Pinned messages 优先（最多 5 条）
  4. 最近消息（最多 20 条，排除最后一条正在处理的 user message）
  5. 总字符数截断到 max 4000
  6. 注入到 adapter 的 --system-prompt 参数
```

### 6.4 产物 Pipeline

```
Agent CLI 输出 stream-json
  → stream-json-parser 解析
  → AgentRuntimeService 检测 artifact_created 事件
  → ArtifactService.createArtifact():
    → 复制文件到 data/artifacts/:id/
    → PPTX: 调用 pptx_to_preview.py 生成 HTML
    → 网页: 设置 mimeType="text/html"
    → previewUrl = /api/artifacts/static/:id/:filename
  → DB 写入 artifacts 表
  → broadcastToConversation("artifact:created")
```

---

## 七、前端架构

### 7.1 状态管理 — 8 个 Zustand Store

| Store | state 核心字段 | 职责 |
|---|---|---|
| `conversationStore` | `conversations[]`, `agentMap{}`, `loading` | 会话 CRUD + 置顶/归档 + Agent 映射 |
| `messageStore` | `messages[]`, `streamingMsgId`, `replyTarget` | 消息 CRUD + 流式增量 + Pin |
| `agentStore` | `agents[]`, `capabilityFilter` | Agent CRUD + 能力过滤 |
| `workspaceStore` | `workspaceId`, `files[]`, `snapshots[]`, `fileChanges[]` | 文件树 + 快照 + 变更 + 刷新 |
| `runStore` | `runs[]`, `toolsByMessage{}`, `orch{}`, `running` | 运行状态 + 工具调用 + 编排进度 |
| `artifactStore` | `artifacts[]`, `deployments[]` | 产物列表 + 部署状态 |
| `uiStore` | `activePanel`, `dialog`, `selected*` | 面板切换 + 弹窗 + 选中项 |
| `editFileStore` | `pendingFilePath`, `editFile()`, `clear()` | 跨组件编辑器信号 |

### 7.2 Web 组件树

```
App
├── Sidebar
│   ├── ConversationList          ← conversationStore + agentStore
│   │   ├── ConversationItem      ← AgentBadge / GroupAvatar
│   │   └── NewConversationModal  ← AgentPicker
│   ├── AgentManagePanel           ← agentStore
│   └── UserProfile
├── ChatArea                       ← messageStore + runStore
│   ├── ChatHeader                 ← member ··· menu + agent info
│   ├── MessageList
│   │   ├── MessageBubble          ← MarkdownContent
│   │   ├── InlineDiffCard
│   │   ├── InlineArtifactCard     ← WebPreviewCard / TextPreviewCard / PptxViewerCard
│   │   └── TaskProgressList
│   └── MessageInput               ← WebSocket send
├── WorkspacePanel                 ← workspaceStore + editFileStore
│   ├── FileTree (tab 1)           ← files[] + snapshot dropdown
│   └── CodeEditorPanel (tab 2)    ← Monaco Editor (lazy) + tabs + Ctrl+S
└── AgentEditModal / AgentDetailModal / AgentDeleteConfirmModal
```

### 7.3 WebSocket 前端集成

`useWebSocket` hook 自动连接到 `ws://<host>:3001/ws`，在 `ChatArea` 中处理所有事件：

```
message:delta       → messageStore.appendDelta()
message:completed   → messageStore.completeMessage()
run:status          → runStore.setRunning()
task:*              → runStore.setOrch()
tool:invocation     → runStore.addToolCall()
file:changed        → workspaceStore.updateFileChange()
artifact:created    → artifactStore.load() 重取
permission:requested → uiStore.openDialog("permission")
```

---

## 八、移动端架构

### 8.1 复用策略

```json
// apps/web/package.json — 暴露内部模块
{ "exports": {
    "./stores/*": "./src/stores/*.ts",
    "./lib/*":    "./src/lib/*.ts",
    "./hooks/*":  "./src/hooks/*.ts",
    "./components/*": "./src/components/*.tsx"
} }

// apps/mobile/package.json — workspace 依赖
{ "dependencies": { "@agenthub/web": "workspace:*" } }
```

复用的内容：
- 所有 Zustand store（直接 import）
- API client 函数（直接 import）
- WebSocket hook（直接 import）
- 叶子组件：AgentBadge, GroupAvatar, MarkdownContent, AgentPicker, CapabilityTags

不复用的内容：
- 页面级组件（独立实现）
- 样式/响应式（移动端专属：safe-area, touch-target ≥44px）

### 8.2 导航

无 Router。Zustand stack 导航：

```typescript
// mobile-ui.store.ts
interface MobileUIState {
  stack: PageEntry[];  // [{name: "home"}, {name: "chat", params: {conversationId}}]
  push(name, params?): void;
  pop(): void;
  goHome(): void;
}
```

页面栈：`home → chat → artifact | approval | settings`

### 8.3 页面列表

| page | 对应组件 | 说明 |
|---|---|---|
| `home` | `ConversationListPage` | 搜索 + 列表 + FAB 新建 |
| `chat` | `ChatPage` | 消息 + WS + 输入 + Run 停止 |
| `artifact` | `ArtifactPreviewPage` | 按类型预览 |
| `approval` | `ApprovalPage` | 权限审批 + Diff apply/revert |
| `settings` | `SettingsPage` | 头像/暗色模式/版本 |
| `offline` | `OfflinePage` | 断网检测 + 重试 |

---

## 九、桌面端架构

### 9.1 Electron 进程模型

```
Main Process (main/)
├── index.ts             窗口管理 (BrowserWindow 1280×800)
├── server-lifecycle.ts  Server 子进程 start/stop/status
│                        + 端口探测 (IPv4/IPv6, 30s timeout)
├── ipc-handlers.ts      IPC 桥接 (dialog.showOpenDialog, CLI检测)
├── cli-detection.ts     claude --version 可用性检测
├── notification.ts      Electron Notification API (Windows appUserModelId)
└── preview-server.ts    本地 HTTP server (127.0.0.1:<random>)
                         静态文件服务 workspace 目录

Preload (preload/)
└── index.ts             contextBridge.exposeInMainWorld("electronAPI", {...})

Renderer
└── 加载 Web UI:
    - 开发模式: http://localhost:5173 (Vite dev server)
    - 打包模式: http://localhost:3001 (内嵌 Hono server 代理 web dist)
```

### 9.2 打包

```
pnpm build:portable
  → tsc 编译 web + mobile + desktop + server
  → electron-builder --dir
  → @agenthub/shared → unpacked node_modules (asarUnpack)
  → server/node_modules junction 桥接 (Windows ESM 模块解析)
  → 生成 AgentHub-Desktop-Portable/
  → 启动器: 启动AgentHub.bat
```

---

## 十、配置

### 10.1 环境变量 (根 `.env`)

```env
# 8 个 Provider 按需选择
PLANNER_PROVIDER=deepseek           # anthropic | deepseek | dashscope | openai | moonshot | openrouter | glm | dobrain
PLANNER_MODEL=deepseek-chat         # 可选覆盖默认模型

# 各 Provider Key
ANTHROPIC_API_KEY=sk-ant-...
DEEPSEEK_API_KEY=sk-...
DASHSCOPE_API_KEY=sk-...
OPENAI_API_KEY=sk-...
MOONSHOT_API_KEY=sk-...
OPENROUTER_API_KEY=sk-or-...
GLM_API_KEY=...
DOBRAIN_API_KEY=...

# Agent 默认工作目录
AGENT_WORKING_DIR=D:/Projects/MasterOfAgents/Test

# 目标端口
PORT=3001
```

### 10.2 Planner Provider 映射

| provider | endpoint | 默认 model | API format |
|---|---|---|---|
| anthropic | api.anthropic.com/v1/messages | claude-sonnet-4-6 | anthropic |
| deepseek | api.deepseek.com/v1/chat/completions | deepseek-chat | openai |
| dashscope | dashscope.aliyuncs.com/.../chat/completions | qwen-max | openai |
| openai | api.openai.com/v1/chat/completions | gpt-4o | openai |
| moonshot | api.moonshot.cn/v1/chat/completions | moonshot-v1-8k | openai |
| openrouter | openrouter.ai/api/v1/chat/completions | anthropic/claude-sonnet-4 | openai |
| glm | open.bigmodel.cn/api/paas/v4/chat/completions | glm-4-plus | openai |
| dobrain | api.dobrain.com/v1/chat/completions | dobrain-v1 | openai |

---

## 十一、安全与边界

| 防护项 | 实现位置 | 方式 |
|---|---|---|
| 文件写入路径穿越 | `WorkspaceService.writeFileContent()` | `path.resolve` + `startsWith` 校验 |
| 快照无限递归 | `WorkspaceService._copyDir()` | 检测 dest 是否在 src 子树内 |
| 文件树栈溢出 | `WorkspaceService._buildTree()` | `depth > 20` 截断 |
| 大文件降级 | `CodeEditorPanel` | `size > 512KB` → 只读文本预览 |
| 编码不可信 | `WorkspaceService.decodeTextBuffer()` | BOM → null-byte 模式 → binary fallback |
| 子进程资源泄漏 | `ProcessSupervisor` | 超时强杀 + 空闲看门狗 + 并发限制 |
| Agent 上下文泄露 | `ChatService.buildAgentContext()` | 过滤 `role=system && runId` 消息 |
| 自建 Agent 删除保护 | `agents.route.ts` | `isCustom === 0` → 400 |
| 内置 Agent 不可删除 | `agents.route.ts` DELETE | 同上 |

---

## 十二、端口与启动

| 服务 | 端口 | 监听 | 启动方式 |
|---|---|---|---|
| Server | 3001 | `0.0.0.0` | `python start-server.py` / `pnpm dev:server` |
| Web | 5173 | `0.0.0.0` | `python start-web.py` / `pnpm dev:web` |
| Mobile | 5174 | `0.0.0.0` | `python start-mobile.py` / `pnpm dev:mobile` |
| Desktop | Electron | — | `python start-desktop.py` / `pnpm dev:desktop` |
| 全部 | 以上所有 | — | `python start-all.py` |
