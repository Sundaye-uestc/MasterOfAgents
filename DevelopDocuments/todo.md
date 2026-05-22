# AgentHub 待办事项

**更新日期：** 2026-05-22

---

## Phase 2：群聊协作

### 2.1 Planner Service（任务规划）

- [ ] 实现 `PlannerService.generateTaskPlan(input)` — 调用 LLM 生成结构化 `TaskPlan` JSON
- [ ] 实现 `validateTaskPlan(plan)` — JSON Schema 校验
- [ ] 降级逻辑：解析/Schema 校验各重试 1 次 → 降级为单 Agent 直接执行

### 2.2 Orchestrator Service（任务调度）

- [ ] 实现 `startOrchestratedRun(input)` — 创建 orchestrated run，调用 Planner，持久化 tasks
- [ ] 实现 DAG 调度器 `scheduleReadyTasks(runId)` — 依赖完成后触发后续任务
- [ ] 实现 `handleTaskCompleted(taskId)` + `aggregateRun(runId)`
- [ ] 调度规则：写入范围重叠串行、高风险任务等确认、子任务失败重试 1 次

### 2.3 完整权限审批流程

- [ ] 解析 Claude Code 的 permission request 流式事件 → `AgentEventPermissionRequest`
- [ ] 前端弹窗展示审批内容（工具名、描述、命令）
- [ ] 后端接收审批结果并写入 Agent stdin
- [ ] 替换当前临时 `bypassPermissions` 方案

### 2.4 群聊会话管理

- [ ] 扩展 `conversation_members`：支持添加/移除多个 Agent 成员
- [ ] 实现 @ Agent 功能：输入框中 @ 指定 Agent 分配任务
- [ ] 群聊创建 UI：新建时选择多个 Agent 参与
- [ ] AgentPicker 组件：多选、按能力标签筛选

### 2.5 协作状态 UI

- [ ] OrchestratorStatusBar — 聊天区顶部展示当前 Run 状态和进度
- [ ] Task 进度展示：每个 task 的 status（queued/running/completed/failed）
- [ ] Tool Invocation 展示：Agent 调用的工具及结果（内联卡片）
- [ ] 多 Agent 消息区分：不同颜色/头像标识
- [ ] AgentStatusBadge + CapabilityTags

### 2.6 自建 Agent（对话式创建）

- [ ] ChatService 识别 `create_agent` intent
- [ ] 生成 `AgentConfigDraft` → 用户确认 → 创建 Custom Agent
- [ ] AgentConfigDraftCard 确认卡片

---

## 当前阻塞与风险

| 风险 | 状态 | 应对 |
|---|---|---|
| 权限审批临时绕过 | 待完善 | `bypassPermissions` 可用，Phase 2 实现完整审批流 |
| Planner LLM 输出不稳定 | 待验证 | JSON Schema 校验 + 重试 + 降级单 Agent |
| 多 Agent 文件写入冲突 | 待处理 | 写入范围检测、串行化、冲突提示 |
| Codex Adapter 未实现 | 待开发 | 接口已预留 |
