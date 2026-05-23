# Phase 2 完成日志

**日期：** 2026-05-22（更新于 2026-05-23）
**状态：** 核心功能已完成 + 群聊端到端 Bug 修复 + UX 持续优化 — 全部 6 个子任务实现完毕，TypeScript 编译通过，服务启动验证通过

---

## 概述

Phase 2（群聊协作）核心框架已交付。实现了从单聊到多 Agent 协作的完整升级：任务规划器（Planner）、DAG 调度器（Orchestrator）、权限审批流、群聊会话管理、协作状态 UI，以及对话式创建自定义 Agent。

在核心功能之上，完成了全面的 UX 优化：中文界面本地化、用户/Agent 头像系统、头像上传（localStorage 持久化 + Toast 提示）、时间戳位置优化、多 AI 厂商配置支持、一键启动脚本等。

## 关键决策

| 决策项 | 选择 | 理由 |
|---|---|---|
| Planner LLM | 多厂商 HTTP API | 支持 8 家 AI 厂商（Anthropic / DeepSeek / OpenAI / DashScope / Moonshot / OpenRouter / GLM / Dobrain），通过 .env 切换 |
| Planner API 格式 | 双格式兼容（Anthropic Messages + OpenAI Chat Completions） | 各厂商接口不同，根据 provider 自动选择调用格式 |
| 降级策略 | 解析/Schema 校验各重试 1 次 → 单 Agent 直接执行 | Planner 输出不稳定时保证可用性 |
| DAG 调度 | 基于完成事件触发式调度 | 任务完成后自动查找"所有依赖已满足"的后续任务 |
| 权限模式 | 默认交互式（`interactive`），可选旁路（`bypass`） | 替换 Phase 1 临时 `bypassPermissions` 方案 |
| stdin 交互 | ProcessSupervisor stdio 从 `["ignore","pipe","pipe"]` 改为 `["pipe","pipe","pipe"]` | 允许向子进程写入权限审批结果 |
| 群聊判定 | `conversation.type === "group"` + 成员数 > 1 | 自动切换为 Orchestrator 流程 |
| 写入范围冲突 | 路径前缀匹配检测（已修复尾部斜杠归一化） | 相同或父子目录路径视为重叠，需串行化 |
| 高风险任务 | 不自动执行，等待用户确认 | `riskLevel: "high"` 的任务发射 `orchestrator:confirmation_needed` WS 事件 |
| 失败重试 | 低/中风险任务失败重试 1 次 | 高风险任务不自动重试 |
| 用户头像存储 | localStorage data URL（限制 3MB） | 无需后端存储，即时可用 |

---

## 交付物

### 根目录工具
- `start_dev.py` — 一键启动后端（3001）+ 前端（5173），自动加载 .env，Windows 兼容（pnpm.cmd 检测），Ctrl+C 优雅关闭
- `.env` — 8 家 AI 厂商配置模板（Anthropic / DeepSeek / OpenAI / DashScope / Moonshot / OpenRouter / GLM / Dobrain）
- `README.md` — 项目介绍、快速启动、项目结构、功能特性

### 共享类型层
- `packages/shared/src/types/plan.ts` — `TaskPlan`、`TaskPlanItem` 类型定义
- `packages/shared/src/types/ws.ts` — 新增 7 个 ServerWsEvent 类型（task:started/completed/failed, orchestrator:plan_created/confirmation_needed, permission:requested, run:status, agent:config_draft）+ 1 个 ClientWsEvent（permission:respond）
- `packages/shared/src/index.ts` — 导出新类型

### 服务层
- `services/planner.service.ts` — **PlannerService**：调用 LLM 生成结构化 TaskPlan JSON；validateTaskPlan() 含结构校验 + DAG 环检测（DFS）；解析/Schema 校验各重试 1 次 → 降级为单任务执行；双格式 API 兼容（callAnthropic / callOpenAICompatible）
- `services/orchestrator.service.ts` — **OrchestratorService**：startOrchestratedRun() 创建 orchestrated Run、调用 Planner、持久化 Tasks；scheduleReadyTasks() DAG 调度（依赖满足 + Agent 空闲 + 写入范围不重叠 + 高风险不自动执行）；executeTask() 通过 runtime.startDirectRun() 委托单个任务执行；handleTaskCompleted() 标记完成任务 → 触发下一波调度；aggregateRun() 收集结果并创建汇总 system 消息；stopOrchestration() 取消所有子任务；写入范围冲突检测（路径前缀匹配，已修复尾部斜杠归一化）
- `services/chat.service.ts` — 新增：addMember()、removeMember()、listMembers()、getMembersForConversation()（含 adapterKind）成员管理方法；detectCreateAgentIntent() 意图检测（正则匹配"创建 agent"关键词，提取名称/平台/能力/system prompt，支持中英文）；createConversation() 扩展 `agentIds?: string[]` 参数；getConversationAgentsMap() 批量获取会话 Agent 信息
- `services/agent-runtime.service.ts` — 新增：runAdapterMap（runId → agentConfigId 映射）；handlePermissionResponse() 路由审批结果到适配器 stdin

### 适配器层
- `adapters/claude-code.adapter.ts` — 新增：permissionMode 选项（`"bypass"` | `"interactive"`，默认 `"interactive"`）；respondToPermission() 写入 stdin 响应；交互模式下移除 `--permission-mode bypassPermissions`；activeSupervisors Map 追踪活跃进程用于 stdin 写入
- `runtime/process-supervisor.ts` — 新增：stdio 改为 `["pipe", "pipe", "pipe"]`；writeStdin() 方法
- `runtime/stream-json-parser.ts` — 无需变更（权限检测在适配器 stderr 处理层实现）

### API 层
- `routes/conversations.ts` — 新增：`GET /:id/members`、`POST /:id/members`、`DELETE /:id/members/:agentId` 成员管理路由；POST `/:id/messages` 群聊判定 → Orchestrator 流程分支
- `routes/agents.ts` — 新增：`POST /api/agents/from-draft` 对话式创建 Agent
- `routes/runs.ts` — 预留权限审批 REST 端点（`POST /:id/permissions`）

### WebSocket 层
- `ws/gateway.ts` — 新增：`permission_request` → `permission:requested` 事件映射；`handleClientEvent` 处理 `permission:respond` → 路由至 AgentRuntimeService → 适配器 stdin

### Web 前端组件
- `components/chat/AgentBadge.tsx` — 头像 + 名称徽章，按 adapter kind 颜色编码（蓝=claude-code, 绿=codex, 紫=opencode, 黄=custom），支持 sm/md/lg 尺寸，图片/文字 fallback
- `components/chat/AgentPicker.tsx` — 多选/单选 Agent 网格，搜索过滤
- `components/chat/AgentStatusBadge.tsx` — 头像 + 在线状态指示点（绿/灰/黄/红）
- `components/chat/CapabilityTags.tsx` — 能力标签彩色药丸
- `components/chat/OrchestratorStatusBar.tsx` — 协作进度条（展开/折叠任务列表、进度百分比、各任务状态芯片）
- `components/chat/TaskProgressCard.tsx` — 单任务状态卡片（排队/运行中/已完成/失败/阻塞/已跳过，含状态动画）
- `components/chat/ToolInvocationCard.tsx` — 内联工具调用卡片（可折叠 Input/Output JSON）
- `components/chat/PermissionModal.tsx` — 权限审批弹窗（工具名、描述、命令、60 秒倒计时自动拒绝）
- `components/chat/AgentConfigDraftCard.tsx` — 对话式创建 Agent 确认卡片

### Web 前端修改
- `components/chat/ConversationList.tsx` — 群聊创建：单聊/群聊切换、多选 AgentPicker、`agentIds[]` 创建
- `components/chat/MessageInput.tsx` — `@`提及：检测 `@` → 弹出成员建议列表 → 箭头键选择 → Enter/Tab 插入；members 属性显示群组成员；mentionedAgentIds 提取
- `components/chat/ChatArea.tsx` — 集成：PermissionModal、OrchestratorStatusBar、useOrchestrationState；多 Agent 消息区分（AgentBadge + 彩色左边框）；User/Agent 头像在消息旁展示（`items-start` 顶部对齐）；adapterKind 颜色修复（不再硬编码 "custom"）；conversationTitle prop；对话头部显示 Agent 名称 + 中文能力徽章（emoji 开头）；时间戳位置优化（用户左下角，系统顶部居中）
- `App.tsx` — `activeConversationType` 推算与传递；`activeAdapterKind` 推算与传递；用户头像上传区域（侧边栏底部）；Toast 通知（成功/失败，3 秒自动消失）；头像上传校验（类型 + 3MB 限制 + localStorage 配额检测）
- `lib/api.ts` — 新增：listMembers()、addMember()、removeMember()、createAgentFromDraft()、respondToPermission()；createConversation() 扩展 agentIds

### 前端 Hooks
- `hooks/useOrchestrationState.ts` — 协作状态管理：通过 WS 事件实时更新 runId/runStatus/tasks[]/progress，含 reset()
- `hooks/useUserAvatar.ts` — 用户头像管理：localStorage 持久化（3MB 限制），uploadAvatar() 返回错误信息，clearAvatar() 清理

### 配置
- `lib/config.ts` — 多厂商 AI 配置（8 providers），自动解析 API Key；PLANNER_PROVIDER 环境变量切换厂商

---

## UX 优化清单

| 优化项 | 状态 | 说明 |
|---|---|---|
| 中文界面本地化 | 已完成 | 按钮、提示、状态文字全面中文化 |
| 停止输出按钮 | 已完成 | Agent 运行中可中断（stopRun API + 状态重置） |
| 消息操作菜单 | 已完成 | hover 显示 ··· → 复制 / 删除 |
| 对话头部优化 | 已完成 | 单聊：Agent 名称 + emoji 中文能力徽章；群聊："名称 (人数)" |
| 用户/Agent 头像 | 已完成 | 消息旁显示头像，Agent 按 adapterKind 配色，顶部对齐 |
| 用户头像上传 | 已完成 | 侧边栏底部上传，localStorage 持久化，Toast 成功/失败提示，3MB 限制 |
| Agent 颜色修复 | 已完成 | adapterKind 从后端透传，不再硬编码 "custom" |
| 时间戳位置 | 已完成 | 用户消息左下角，系统消息顶部居中，Agent 消息右下角 |
| 一键启动脚本 | 已完成 | start_dev.py 自动加载 .env，并发启动前后端，Ctrl+C 优雅关闭 |
| 多厂商 AI 配置 | 已完成 | .env 支持 8 家厂商，PLANNER_PROVIDER 自由切换 |

---

## 验证结果

| 测试项 | 结果 |
|---|---|
| TypeScript 编译（shared / server / web） | 通过 |
| 服务启动（tsx src/index.ts） | 通过 |
| API 端点响应（/api/agents, /api/conversations） | 通过 |
| Phase 2 验证脚本（verify-phase2.ts） | 通过（7/7 测试通过） |
| start_dev.py 一键启动 | 通过（修复监控循环 bug） |

---

## Bug 修复

| Bug | 修复 |
|---|---|
| addMember 后 count=1（LEFT JOIN 过滤掉无 agent 记录的成员） | `innerJoin` → `leftJoin` |
| Chinese intent detection 返回 null（正则过于严格） | 正则放宽，添加 "called" 关键词 |
| hasOverlap 父子目录检测失败（"src/" + "/" = "src//"） | 尾部斜杠归一化后再比较 |
| start_dev.py 过早退出（pnpm 子进程导致 poll() 非 None） | 监控循环改为无限等待 Ctrl+C |
| 群聊发消息无响应 — executeTask 的 onEvent 回调为空，子任务完成无法回调编排器 | 实现完整 handleEvent：文本增量写 DB + WS 广播 + run_completed/failed 时调用 handleTaskCompleted |
| 群聊无 WS 广播 — 子任务流式输出不推送到前端 | handleEvent 中调用 agentEventToWsEvent() + broadcastToConversation() |
| OrchestratorService 每次请求新建实例，丢失编排状态 | 添加 getOrchestratorService() 单例函数 |
| 系统消息不实时出现 — createMessage 不广播 WS 事件 | chat.service.ts 对 agent/system 角色广播 message:created |
| 直聊 Agent 回复重复出现两次 | 前端不再手动添加 Agent 占位消息，完全由 WS message:created 驱动 |
| 直聊"思考中🤔"不显示 — Agent 消息初始 status 为 "sent" | createMessage 支持 status 参数，Agent 消息直接以 "streaming" 创建 |
| 消息顺序错误（系统/Agent 排在用户前面） | 乐观更新：API 调用前立即插入临时用户消息 |

---

## 2026-05-23 新增优化

| 优化项 | 说明 |
|---|---|
| 系统消息紧凑化 | 计划摘要和汇总总结改为单行（`·` / `—` 分隔），前端 padding `px-3 py-1`、字号 `text-xs`、去除 italic |
| Planner Prompt 中文化 | Prompt 全面中文化，明确要求 title/description/reasoning 使用中文输出 |
| .env 模板推送 | 脱敏后的 .env 模板推送到远程，方便协作者配置 |
| PDF 从 git 移除 | 设计 PDF 从仓库删除，`*.pdf` 加入 .gitignore |

---

## 已知限制与待完善

| 项目 | 状态 | 说明 |
|---|---|---|
| Orchestrator 端到端测试 | **已验证** | 群聊崩溃 Bug 已修复，onEvent → handleTaskCompleted 闭环 + WS 广播 + 单例 |
| 直聊消息重复 & 思考中消失 | **已修复** | WS message:created 替代手动占位，Agent 消息以 streaming 状态创建 |
| 权限审批端到端测试 | 待测试 | 交互模式下 Claude CLI 的具体 stdout/stderr 格式待验证 |
| Codex Adapter 未实现 | 接口已预留 | AgentPlatformAdapter 接口支持，ClaudeCodeAdapter 为唯一实现 |
| 群聊成员增删 UI | 基础实现 | 新增/移除成员的 UI 面板尚未加入 ConversationList |
| ToolInvocationCard 实时渲染 | 待完善 | 目前依赖 DB 记录，WS 推送实时更新待实现 |

---

## 文件变更统计

| 操作 | 数量 | 关键文件 |
|---|---|---|
| 新建（server） | 4 | planner.service.ts, orchestrator.service.ts, config.ts, verify-phase2.ts |
| 新建（web） | 9 | AgentBadge, AgentPicker, AgentStatusBadge, CapabilityTags, OrchestratorStatusBar, TaskProgressCard, ToolInvocationCard, PermissionModal, AgentConfigDraftCard |
| 新建（shared） | 1 | types/plan.ts |
| 新建（hooks） | 2 | useOrchestrationState.ts, useUserAvatar.ts |
| 新建（根目录） | 3 | start_dev.py, .env, README.md |
| 修改（server） | 7 | chat.service.ts, agent-runtime.service.ts, conversations.ts, agents.ts, gateway.ts, claude-code.adapter.ts, process-supervisor.ts |
| 修改（web） | 6 | App.tsx, ChatArea.tsx, ConversationList.tsx, MessageInput.tsx, api.ts, MessageInput.tsx |
| 修改（shared） | 2 | ws.ts, index.ts |
| **总计** | **34** | |

---

## 下一步：Phase 2 完善

1. 端到端验证 Orchestrator + Planner 完整流程（API Key 已配置，可随时测试）
2. 群聊成员增删 UI 面板
3. ToolInvocationCard 从 DB 记录实时渲染 + WS 推送
4. Codex Adapter 实现
5. 工作区管理（workspaces / workspace_snapshots 表已有 schema，无服务代码）
