# AgentHub 待办事项

**更新日期：** 2026-05-23

---

## Phase 2：群聊协作 — 核心已完成

### 2.1 Planner Service（任务规划）

- [x] 实现 `PlannerService.generateTaskPlan(input)` — 调用 LLM 生成结构化 `TaskPlan` JSON
- [x] 实现 `validateTaskPlan(plan)` — JSON Schema 校验
- [x] 降级逻辑：解析/Schema 校验各重试 1 次 → 降级为单 Agent 直接执行
- [x] 多 AI 厂商支持（anthropic / deepseek / openai / dashscope / moonshot / openrouter / glm / dobrain）

### 2.2 Orchestrator Service（任务调度）

- [x] 实现 `startOrchestratedRun(input)` — 创建 orchestrated run，调用 Planner，持久化 tasks
- [x] 实现 DAG 调度器 `scheduleReadyTasks(runId)` — 依赖完成后触发后续任务
- [x] 实现 `handleTaskCompleted(taskId)` + `aggregateRun(runId)`
- [x] 调度规则：写入范围重叠串行、高风险任务等确认、子任务失败重试 1 次

### 2.3 完整权限审批流程

- [x] 解析 Claude Code 的 permission request 流式事件 → `AgentEventPermissionRequest`
- [x] 前端弹窗展示审批内容（工具名、描述、命令）
- [x] 后端接收审批结果并写入 Agent stdin
- [x] 替换当前临时 `bypassPermissions` 方案

### 2.4 群聊会话管理

- [x] 扩展 `conversation_members`：支持添加/移除多个 Agent 成员
- [x] 实现 @ Agent 功能：输入框中 @ 指定 Agent 分配任务
- [x] 群聊创建 UI：新建时选择多个 Agent 参与
- [x] AgentPicker 组件：多选、按能力标签筛选

### 2.5 协作状态 UI

- [x] OrchestratorStatusBar — 聊天区顶部展示当前 Run 状态和进度
- [x] Task 进度展示：每个 task 的 status（queued/running/completed/failed）
- [x] Tool Invocation 展示：Agent 调用的工具及结果（内联卡片）
- [x] 多 Agent 消息区分：不同颜色/头像标识
- [x] AgentStatusBadge + CapabilityTags

### 2.6 自建 Agent（对话式创建）

- [x] ChatService 识别 `create_agent` intent
- [x] 生成 `AgentConfigDraft` → 用户确认 → 创建 Custom Agent
- [x] AgentConfigDraftCard 确认卡片

---

## UX 优化（已完成）

- [x] 中文界面本地化（按钮、提示、状态文字）
- [x] 停止输出按钮（Agent 运行中可中断）
- [x] 消息右键菜单（复制 / 删除）
- [x] 对话头部优化：单聊显示 Agent 名称 + 中文能力徽章（emoji 开头），群聊显示"名称 (人数)"
- [x] 用户 & Agent 头像：消息旁显示头像，Agent 头像按 adapterKind 配色
- [x] 用户头像上传：侧边栏底部上传区域，localStorage 持久化，带 Toast 成功/失败提示（限制 3MB）
- [x] 时间戳位置优化：用户消息左下角，系统消息顶部居中
- [x] 根目录 `start_dev.py` 一键启动脚本 + `.env` 多厂商配置 + `README.md`
- [x] 系统消息紧凑化：计划/汇总改为单行，小字号小 padding，去除 italic
- [x] Planner Prompt 中文化：LLM 输出中文标题/描述/推理
- [x] .env 模板脱敏推送 + PDF 从 git 移除（`*.pdf` → .gitignore）

---

## Phase 2 待完善

### 端到端验证
- [x] Orchestrator + Planner 完整流程测试（群聊崩溃 Bug 已修复，onEvent → handleTaskCompleted 闭环 + WS 广播）
- [ ] 权限审批交互模式端到端测试
- [ ] ToolInvocationCard 从 DB 记录实时渲染 & WS 推送

### 群聊管理增强
- [ ] 群聊成员增删 UI 面板（ConversationList 内嵌）

### 适配器
- [ ] Codex Adapter 实现

### 工作区
- [ ] workspaces / workspace_snapshots 服务代码（schema 已有）

---

## 当前阻塞与风险

| 风险 | 状态 | 应对 |
|---|---|---|
| 权限审批临时绕过 | **已解决** | 实现交互模式 + stdin 响应 |
| Orchestrator 子任务回调缺失 | **已解决** | onEvent 完整实现 → handleTaskCompleted 闭环 |
| Planner LLM 输出不稳定 | 已应对 | JSON Schema 校验 + 重试 + 降级单 Agent |
| 多 Agent 文件写入冲突 | 已应对 | 写入范围检测、串行化 |
| Codex Adapter 未实现 | 待开发 | 接口已预留 |
| Planner API Key | **已配置** | 支持 8 家 AI 厂商，用户填写 .env 即可 |
