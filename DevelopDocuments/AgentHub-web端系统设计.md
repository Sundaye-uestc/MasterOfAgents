# AgentHub 系统设计

## 1. 开工约束

- 新建目录：`AgentHub/`
- 后端：Node.js + TypeScript，自建服务端
- 前端：React + Vite，复用 AgentVerse UI/Markdown/主题组件
- Agent 接入：平台接入优先，不用 Prompt 模拟 Claude Code/Codex
- 用户模型：单用户
- 数据库：SQLite + Drizzle
- 实时通信：WebSocket
- MVP 平台：Claude Code + Codex/OpenCode 二选一

## 2. 技术栈

| 层 | 选型 |
|---|---|
| Web | React, Vite, Tailwind, Zustand, RxJS |
| Server | Node.js, TypeScript, Hono, WebSocket |
| DB | SQLite, Drizzle ORM |
| Agent | Claude Code SDK/CLI, Codex CLI/Cloud 或 OpenCode |
| Planner LLM | GPT-4o-mini / Claude Haiku / 同级轻量模型 |
| 文件/产物 | Local FS |
| 执行隔离 | Workspace + Sandbox + Permission Policy |

## 3. 目录结构

```text
AgentHub/
├── package.json
├── pnpm-workspace.yaml
├── .env.example
├── apps/
│   ├── web/
│   │   └── src/
│   │       ├── components/
│   │       │   ├── ui/
│   │       │   ├── chat/
│   │       │   ├── artifact/
│   │       │   ├── agent/
│   │       │   └── workspace/
│   │       ├── stores/
│   │       ├── hooks/
│   │       ├── lib/
│   │       └── types/
│   └── server/
│       └── src/
│           ├── index.ts
│           ├── app.ts
│           ├── routes/
│           ├── ws/
│           ├── services/
│           │   ├── chat.service.ts
│           │   ├── planner.service.ts
│           │   ├── orchestrator.service.ts
│           │   ├── agent-runtime.service.ts
│           │   ├── workspace.service.ts
│           │   ├── artifact.service.ts
│           │   ├── deploy.service.ts
│           │   └── security.service.ts
│           ├── adapters/
│           │   ├── base.ts
│           │   ├── claude-code.adapter.ts
│           │   ├── codex.adapter.ts
│           │   ├── opencode.adapter.ts
│           │   └── custom-agent.adapter.ts
│           ├── orchestrator/
│           ├── runtime/
│           │   ├── process-supervisor.ts
│           │   └── stream-json-parser.ts
│           ├── db/
│           └── lib/
└── packages/
    └── shared/
        └── src/
            ├── types/
            ├── schemas/
            └── constants.ts
```

## 4. 后端模块

| 模块 | 职责 |
|---|---|
| `ChatService` | 会话、成员、消息、搜索、归档、上下文组装 |
| `PlannerService` | 调用 Planner LLM，生成结构化 `TaskPlan` |
| `AgentRuntimeService` | Adapter 生命周期、Run 启停、事件归一化 |
| `OrchestratorService` | 群聊任务计划、DAG 调度、结果聚合 |
| `ProcessSupervisor` | 子进程 spawn、stdout/stderr、超时 kill、并发控制 |
| `WorkspaceService` | workspace 分配、快照、文件变更、Diff 应用 |
| `ArtifactService` | 产物记录、预览 URL、文件下载 |
| `DeployService` | 本地预览、静态站点部署、状态卡片 |
| `SecurityService` | secrets、权限审批、命令策略、审计日志 |
| `WsGateway` | WS 连接、事件路由、断线恢复 |

## 5. Agent Adapter

```ts
export interface AgentPlatformAdapter {
  id: string;
  name: string;
  kind: "claude-code" | "codex" | "opencode" | "custom";

  prepare(config: AgentInstanceConfig): Promise<void>;
  run(input: AgentRunInput): AsyncIterable<AgentEvent>;
  stop(runId: string): Promise<void>;
  dispose(): Promise<void>;
}

export interface AgentRunInput {
  runId: string;
  taskId?: string;
  conversationId: string;
  agentId: string;
  prompt: string;
  history: ChatMessage[];
  workspace: WorkspaceRef;
  permissions: PermissionPolicy;
  env: Record<string, string>;
  signal: AbortSignal;
}

export type AgentEvent =
  | { type: "run_started"; runId: string; agentId: string }
  | { type: "text_delta"; runId: string; messageId: string; content: string }
  | { type: "thinking"; runId: string; content: string }
  | { type: "tool_call"; runId: string; toolCallId: string; name: string; input: unknown }
  | { type: "tool_result"; runId: string; toolCallId: string; status: "success" | "error"; output?: unknown; error?: string }
  | { type: "permission_required"; runId: string; request: PermissionRequest }
  | { type: "file_change"; runId: string; change: FileChange }
  | { type: "artifact_created"; runId: string; artifactId: string }
  | { type: "run_completed"; runId: string; usage?: TokenUsage }
  | { type: "run_failed"; runId: string; code: string; message: string };
```

## 6. Agent 接入顺序

| 优先级 | Adapter | 接入方式 |
|---|---|---|
| P0 | Claude Code | `@anthropic-ai/claude-code` SDK，失败则用 `claude -p --output-format stream-json` |
| P1 | Codex | Codex CLI/Cloud；不可用时降级为 Codex 模型 + Responses API |
| P1 备选 | OpenCode | CLI/Server |
| P2 | Custom Agent | 模型 API + 本地 Tool Registry |

Phase 0 必须先验证 Claude Code 可编程接入方式；若 SDK 不稳定，直接采用 CLI 子进程方案。

## 7. 数据模型

```sql
conversations(
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  pinned_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

conversation_members(
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  role TEXT,
  auto_reply INTEGER DEFAULT 1,
  joined_at TEXT NOT NULL
);

agents(
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  avatar TEXT,
  adapter_kind TEXT NOT NULL,
  config_json TEXT NOT NULL,
  capabilities_json TEXT,
  status TEXT NOT NULL DEFAULT 'unknown',
  status_reason TEXT,
  last_checked_at TEXT,
  is_custom INTEGER DEFAULT 0,
  enabled INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

messages(
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  run_id TEXT,
  task_id TEXT,
  agent_id TEXT,
  reply_to_id TEXT,
  role TEXT NOT NULL,
  content TEXT,
  segments_json TEXT,
  status TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

runs(
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  trigger_message_id TEXT,
  mode TEXT NOT NULL,
  status TEXT NOT NULL,
  plan_json TEXT,
  planner_model TEXT,
  error_json TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL
);

tasks(
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  agent_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  dependencies_json TEXT,
  status TEXT NOT NULL,
  expected_output TEXT,
  result_summary TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

tool_invocations(
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  task_id TEXT,
  agent_id TEXT,
  tool_name TEXT NOT NULL,
  input_json TEXT,
  output_json TEXT,
  status TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT
);

workspaces(
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  root_path TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

workspace_snapshots(
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  run_id TEXT,
  label TEXT,
  manifest_json TEXT,
  created_at TEXT NOT NULL
);

file_changes(
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  task_id TEXT,
  path TEXT NOT NULL,
  change_type TEXT NOT NULL,
  before_hash TEXT,
  after_hash TEXT,
  diff TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

artifacts(
  id TEXT PRIMARY KEY,
  run_id TEXT,
  message_id TEXT,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  path TEXT,
  mime_type TEXT,
  size INTEGER,
  preview_url TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);

deployments(
  id TEXT PRIMARY KEY,
  artifact_id TEXT,
  run_id TEXT,
  status TEXT NOT NULL,
  target TEXT,
  url TEXT,
  log TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

secrets(
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  provider TEXT,
  encrypted_value TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

audit_logs(
  id TEXT PRIMARY KEY,
  run_id TEXT,
  action TEXT NOT NULL,
  detail_json TEXT,
  created_at TEXT NOT NULL
);
```

消息级 Pin：

- Pin 存在 `messages.metadata_json.pinned = true`
- ContextBuilder 构造上下文时按顺序注入 pinned messages
- `conversations.pinned_at` 仅表示会话置顶，不表示长期上下文

## 8. 运行流

### 单聊

```text
message:send
→ persist user message
→ create run(mode=direct)
→ create before snapshot
→ AgentRuntime.start(adapter)
→ normalize AgentEvent
→ persist message/tool/file/artifact
→ push WS events
→ create after snapshot
→ complete run
```

### 群聊

```text
message:send
→ persist user message
→ create run(mode=orchestrated)
→ PlannerService.generateTaskPlan()
→ invalid plan? fallback to direct single-agent run
→ persist tasks
→ schedule ready tasks by DAG
→ AgentRuntime.start(task.agent)
→ persist outputs/file changes
→ aggregate result
→ post orchestrator summary
→ complete run
```

## 9. 状态机

```text
Run:
queued → running → completed
              ├→ waiting_permission → running
              ├→ failed
              └→ cancelled

Task:
queued → running → completed
              ├→ blocked
              ├→ failed
              └→ skipped
```

## 10. Orchestrator

Planner LLM：

- 默认模型：`GPT-4o-mini` / `Claude Haiku` / 同级轻量模型
- 输入：用户消息、pinned messages、最近历史、成员 Agent、能力标签、workspace 文件摘要
- 输出：严格 JSON，必须匹配 `TaskPlan`
- 校验失败：重试 1 次；仍失败则降级为单 Agent 直接执行

```ts
export interface TaskPlan {
  runId: string;
  summary: string;
  strategy: "single" | "sequential" | "parallel" | "mixed";
  tasks: Array<{
    id: string;
    title: string;
    description: string;
    agentId: string;
    dependencies: string[];
    expectedOutput: string;
    writeScope?: string[];
    riskLevel: "low" | "medium" | "high";
  }>;
  confirmationRequired?: boolean;
}
```

调度规则：

- 依赖完成后进入 ready 队列。
- 写入范围重叠的任务串行。
- 无写入冲突的任务可并行。
- 高风险任务进入 `waiting_permission`。
- 子任务失败默认重试 1 次，再尝试同能力 Agent。

Planner System Prompt 约束：

- 只输出 JSON
- 不输出 Markdown
- `tasks[].agentId` 必须来自候选 Agent 列表
- `dependencies` 只能引用同一 plan 内 task id
- 高风险操作设置 `confirmationRequired = true`

## 10.1 平台进程管理

ProcessSupervisor 必须支持：

- `spawn(command, args, env, cwd)`
- stdout stream-json 解析
- stderr 捕获并写入 `audit_logs`
- AbortSignal 触发进程 kill
- run timeout 强杀
- 最大并发数：默认 3
- 同一 workspace 写任务互斥

```ts
export interface ProcessSupervisor {
  start(spec: ProcessSpec): AsyncIterable<ProcessEvent>;
  stop(processId: string): Promise<void>;
  getActiveCount(): number;
}
```

## 11. WebSocket 协议

```ts
export type ClientEvent =
  | { type: "message:send"; conversationId: string; content: string; mentions?: string[] }
  | { type: "message:reply"; conversationId: string; content: string; replyToId: string; mentions?: string[] }
  | { type: "message:retry"; messageId: string }
  | { type: "message:pin"; messageId: string; pinned: boolean }
  | { type: "run:stop"; runId: string }
  | { type: "permission:approve"; requestId: string }
  | { type: "permission:deny"; requestId: string }
  | { type: "diff:apply"; fileChangeId: string }
  | { type: "diff:revert"; fileChangeId: string };

export type ServerEvent =
  | { type: "message:created"; message: Message }
  | { type: "message:delta"; messageId: string; content: string }
  | { type: "message:completed"; messageId: string }
  | { type: "run:status"; runId: string; status: RunStatus }
  | { type: "task:status"; taskId: string; status: TaskStatus }
  | { type: "agent:tool_call"; toolInvocation: ToolInvocation }
  | { type: "agent:tool_result"; toolInvocation: ToolInvocation }
  | { type: "permission:required"; request: PermissionRequest }
  | { type: "file:changed"; change: FileChange }
  | { type: "artifact:created"; artifact: Artifact }
  | { type: "deploy:status"; deployment: Deployment }
  | { type: "error"; code: string; message: string; runId?: string };
```

断线恢复：

- 重连后调用 `GET /api/runs/active`
- 重连后调用 `GET /api/conversations/:id/messages`
- 所有 message/run/task/tool 中间态必须落库

## 12. REST API

```http
GET    /api/conversations
GET    /api/conversations?q=keyword
POST   /api/conversations
PATCH  /api/conversations/:id/archive
PATCH  /api/conversations/:id/unarchive
GET    /api/conversations/:id/messages
POST   /api/conversations/:id/messages
PATCH  /api/messages/:id/pin

GET    /api/agents
POST   /api/agents
PATCH  /api/agents/:id
POST   /api/agents/:id/test
POST   /api/agents/create-from-chat

GET    /api/runs/:id
POST   /api/runs/:id/stop
GET    /api/runs/active

GET    /api/workspaces/:id/files
GET    /api/workspaces/:id/snapshots
POST   /api/file-changes/:id/apply
POST   /api/file-changes/:id/revert

GET    /api/artifacts/:id
POST   /api/artifacts/:id/deploy

GET    /api/secrets
POST   /api/secrets
DELETE /api/secrets/:id
```

## 13. 安全策略

| 能力 | 默认策略 |
|---|---|
| `read_file` | 仅 workspace 内允许 |
| `write_file` | 允许，必须记录 `file_changes` |
| `execute_command` | 高风险命令需确认 |
| `network_access` | 默认限制，dev 模式可 allowlist |
| `deploy` | 必须确认 |
| `secret_access` | 默认拒绝，只通过受控 env 注入 |

Sandbox 模式：

| 模式 | 用途 |
|---|---|
| `readonly` | 代码分析、审查 |
| `dev` | 代码生成、安装依赖、测试 |
| `deploy` | 构建、预览、发布 |

## 14. AgentVerse 复用

| 复用项 | 路径 | 处理 |
|---|---|---|
| UI 组件 | `src/common/components/ui/` | 直接 port |
| Markdown | `src/common/components/ui/markdown/` | 直接 port，扩展 artifact/diff |
| 主题/断点 | `src/common/components/common/` | 直接 port |
| Zustand/RxJS 模式 | `src/core/stores/`, `src/common/lib/rx-state/` | 复用模式，业务 store 重写 |
| 流式工具循环 | `src/core/managers/discussion/streaming-responder.ts` | 参考逻辑，后端重写 |
| 下一发言人选择 | `src/core/managers/discussion/next-speaker.ts` | 群聊 fallback |
| AIService | `src/common/lib/ai-service/` | 只参考 stream/tool parsing，不复用 browser key 实现 |

## 15. 自建 Agent 流程

```text
用户输入“创建一个擅长数据分析的 Agent”
→ ChatService 识别 create_agent intent
→ 调 LLM 生成 AgentConfig 草案
→ 前端展示确认卡片
→ 用户确认
→ POST /api/agents
→ 新 Agent 出现在 AgentPicker/联系人列表
```

```ts
export interface AgentConfigDraft {
  name: string;
  slug: string;
  avatar?: string;
  adapterKind: "custom";
  systemPrompt: string;
  capabilities: string[];
  tools: string[];
}
```

## 16. 开发顺序

### Phase 0：平台 Adapter PoC

- [ ] 初始化 `AgentHub/`
- [ ] 验证 Claude Code SDK 是否稳定可用
- [ ] Claude Code CLI 子进程 `stream-json` 跑通
- [ ] ProcessSupervisor 支持 spawn/stdout/stderr/kill/timeout
- [ ] Codex 或 OpenCode Adapter 跑通 stream
- [ ] 统一 `AgentEvent`
- [ ] 支持并发限制、stop、timeout、error

### Phase 1：1v1 闭环

- [ ] Hono + WS + SQLite + Drizzle
- [ ] conversations/messages/runs/tool_invocations
- [ ] ChatArea + ConversationList + MessageInput
- [ ] 对话搜索和归档/取消归档
- [ ] 引用回复 UI 和 `reply_to_id`
- [ ] Agent 消息重新生成按钮
- [ ] 1v1 调用真实平台 Agent
- [ ] before/after snapshot
- [ ] 消息级 pin 注入上下文
- [ ] file_changes + artifact 卡片

### Phase 2：群聊协作

- [ ] conversation_members
- [ ] AgentPicker
- [ ] Agent 状态检测和能力标签展示
- [ ] PlannerService 生成结构化 TaskPlan
- [ ] TaskPlan JSON 校验和降级策略
- [ ] DAG Scheduler
- [ ] task/run 状态 UI
- [ ] 聚合总结消息
- [ ] ChatService 识别 create_agent intent，生成 AgentConfigDraft

### Phase 3：产物与部署

- [ ] Diff apply/revert
- [ ] Web iframe preview
- [ ] workspace zip download
- [ ] local static deploy
- [ ] deploy status card
- [ ] 对话式创建 Custom Agent

## 17. MVP 验收

- [ ] 单聊 Claude Code Agent 能流式回复
- [ ] Claude Code 接入方式已在 Phase 0 明确：SDK 或 CLI
- [ ] Agent 能产生文件变更
- [ ] 前端能展示 Diff 卡片
- [ ] 前端能展示网页预览卡片
- [ ] 用户能 apply/revert Diff
- [ ] 会话列表支持搜索
- [ ] 消息支持引用回复和重新生成
- [ ] 会话支持归档/取消归档
- [ ] 消息级 Pin 会进入 Agent 上下文
- [ ] Planner LLM 能生成合法 TaskPlan
- [ ] Planner 输出非法时能降级为单 Agent 执行
- [ ] 群聊能分派至少 2 个任务
- [ ] 前端实时显示 run/task/tool 状态
- [ ] AgentPicker 展示 Agent 可用状态和能力标签
- [ ] 刷新页面后消息和运行状态可恢复
- [ ] 能通过对话式流程创建 Custom Agent
- [ ] 能生成下载包或本地部署预览 URL
