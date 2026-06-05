# Phase 2 完成日志

**日期：** 2026-05-28
**状态：** 已完成

---

## 概述

Phase 2（群聊协作）实现从单聊到多 Agent 协作的升级：任务规划器（Planner）、DAG 调度器（Orchestrator）、权限审批流、群聊会话管理、协作状态 UI、对话式创建 Agent。

## 关键决策

| 决策 | 选择 | 理由 |
|---|---|---|
| Planner LLM | 多厂商 HTTP API（8 家：Anthropic / DeepSeek / OpenAI / DashScope / Moonshot / OpenRouter / GLM / Dobrain） | 通过 `PLANNER_PROVIDER` 环境变量切换 |
| Planner 降级 | 解析/Schema 校验各重试 1 次 → 单 Agent 直接执行 | 输出不稳定时保证可用 |
| @mention 任务解析 | 正则提取 `@Agent` 分派任务，绕过 LLM | LLM 对中文 task-decomposition 不稳定 |
| DAG 调度 | 基于完成事件触发式调度 | 任务完成后自动查找依赖已满足的后续任务 |
| 权限模式 | 默认旁路 `bypassPermissions`，可选 `interactive` | 需要审批时显式传入 |
| 写入范围冲突 | 路径前缀匹配检测 | 父子目录路径重叠需串行化 |
| 高风险任务 | 不自动执行，等待确认 | `riskLevel: "high"` → `confirmation_needed` WS 事件 |
| 失败重试 | 低/中风险重试 1 次 | 高风险不自动重试 |

---

## 交付物

### 服务端

| 文件 | 说明 |
|---|---|
| `services/planner.service.ts` | LLM → TaskPlan JSON；validateTaskPlan() 含 DAG 环检测；双格式 API（Anthropic + OpenAI Compatible） |
| `services/orchestrator.service.ts` | startOrchestratedRun() → Planner → 持久化 Tasks → DAG 调度 → 聚合结果 |
| `services/workspace.service.ts` | Workspace CRUD + Snapshot CRUD |
| `services/chat.service.ts` | 成员管理（add/remove/list）、detectCreateAgentIntent()、群聊判定 |
| `services/agent-runtime.service.ts` | runAdapterMap、handlePermissionResponse() → 适配器 stdin |
| `adapters/claude-code.adapter.ts` | permissionMode（bypass/interactive）、respondToPermission() |
| `adapters/codex.adapter.ts` | Codex/OpenCode CLI 适配器；prepare() 失败自动降级 ClaudeCodeAdapter |
| `runtime/process-supervisor.ts` | stdio `["pipe","pipe","pipe"]`、writeStdin() |
| `routes/conversations.ts` | 成员管理路由；群聊消息 → Orchestrator 流程 |
| `routes/agents.ts` | POST `/from-draft` 对话式创建 Agent |
| `routes/workspaces.ts` | Workspace + Snapshot REST API（6 端点） |
| `ws/gateway.ts` | 权限审批/编排 WS 事件映射 |
| `lib/config.ts` | 8 家 AI 厂商配置 |

### 共享类型
- `types/plan.ts` — TaskPlan、TaskPlanItem
- `types/ws.ts` — 新增 8 个 WS 事件类型（task:*、orchestrator:*、permission:*、run:status、agent:config_draft）

### 前端

| 组件 | 说明 |
|---|---|
| `AgentBadge` | 头像 + 名称徽章，按 adapterKind 颜色编码（sm/md/lg） |
| `AgentPicker` | 多选/单选 Agent 网格，搜索过滤 |
| `AgentStatusBadge` | 头像 + 在线状态指示点 |
| `CapabilityTags` | 能力标签彩色药丸 |
| `OrchestratorStatusBar` | 协作进度条（展开/折叠、进度百分比、任务状态） |
| `TaskProgressCard` | 单任务状态卡片（排队/运行中/已完成/失败/阻塞） |
| `ToolInvocationCard` | 内联工具调用卡片（可折叠 Input/Output JSON） |
| `PermissionModal` | 权限审批弹窗（60 秒倒计时自动拒绝） |
| `AgentConfigDraftCard` | 对话式创建 Agent 确认卡片 |
| `MarkdownContent` | react-markdown + remark-gfm，暗色主题渲染 |

### 前端修改

| 文件 | 变更 |
|---|---|
| `ConversationList.tsx` | 单聊/群聊切换、多选 AgentPicker、成员管理 UI |
| `MessageInput.tsx` | `@` 提及弹窗（箭头键选择、Enter/Tab 插入） |
| `ChatArea.tsx` | 集成 PermissionModal / OrchestratorStatusBar / ToolInvocationCard；多 Agent 消息区分 |
| `App.tsx` | 用户头像上传（localStorage 3MB）、Toast 通知 |
| `lib/api.ts` | 成员/Agent/Workspace API 客户端 |

### 根目录
- `start_dev.py` — 一键启动前后端，自动加载 .env，Ctrl+C 优雅关闭
- `.env` — 8 家 AI 厂商配置模板

---

## UX 特性

| 特性 | 说明 |
|---|---|
| 中文界面本地化 | 全面中文化 |
| `@` 提及 | `@` 弹出成员列表 → 箭头键选择 |
| 用户/Agent 头像 | 消息旁显示，Agent 按 adapterKind 配色 |
| 用户头像上传 | 侧边栏底部，localStorage 持久化，Toast 提示 |
| 协作进度条 | 展开/折叠，任务状态芯片，进度百分比 |
| 工具调用卡片 | 可折叠 Input/Output JSON |
| Markdown 渲染 | react-markdown + GFM（表格/代码块/列表） |
| 一键启动脚本 | start_dev.py，并发启动前后端 |
| 多厂商 AI 配置 | .env 8 家厂商自由切换 |

---

## 验证结果

| 验证项 | 状态 |
|---|---|
| TypeScript 编译（shared / server / web） | ✅ |
| Planner → TaskPlan 生成 + 降级 | ✅ |
| DAG 调度（依赖满足 + 写入冲突检测 + 并行执行） | ✅ |
| @mention 任务解析（绕过 LLM，正则提取） | ✅ |
| 群聊成员管理（add/remove/list） | ✅ |
| 权限审批流（弹窗 + 60s 倒计时 + stdin） | ✅ |
| 对话式创建 Agent | ✅ |
| ToolInvocationCard 实时渲染 | ✅ |
| Markdown 渲染 | ✅ |
| 用户头像上传 | ✅ |
| start_dev.py 一键启动 | ✅ |
| CodexAdapter 降级（CLI 未安装 → ClaudeCodeAdapter） | ✅ |

---

## 下一步：Phase 3

群聊协作框架已稳定，Phase 3 将完善产物管理与前端架构。工作项：
1. File Changes 闭环 — before/after snapshot diff + WS 实时广播 + apply/revert
2. Artifact 系统 — 产物存储、static file serving、WebPreviewCard / DownloadCard
3. 部署服务 — local-static 预览 + zip 归档下载
4. 安全服务 — AES-256-GCM 加密存储 + 审计日志
5. Workspace 前端面板 — 文件树 / 快照时间线 / 变更列表
6. 前端架构升级 — Zustand 7 stores + event-dispatcher + 组件拆分
