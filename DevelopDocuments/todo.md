# AgentHub 待办事项

**更新日期：** 2026-05-22
**Phase 1 状态：** 已完成

---

## Phase 1 收尾（可择机处理）

以下为设计文档中规划但尚未实现的能力，优先级低于 Phase 2 核心工作：

| 待办项 | 说明 | 优先级 |
|---|---|---|
| 消息"重新生成" | MessageBubble 增加 RegenerateButton，允许用户让 Agent 重新回答 | 中 |
| 消息"引用回复" UI | 当前 API 已支持 `replyToId`，前端缺少 ReplyPreviewCard 和回复缩略卡片 | 中 |
| PinnedMessageBar | 在聊天区顶部展示已 Pin 消息的横条 | 低 |
| 独立的 MessageBubble / MessageList | 目前逻辑内联在 ChatArea.tsx 中，需拆分为独立组件 | 低 |
| Zustand 状态管理迁移 | 目前使用 React useState + props 传递，后续群聊状态复杂后建议迁移到 Zustand stores | 低 |
| FileChange 基础展示 | API 已支持采集 file_changes，前端缺少 Diff 卡片展示 | 中 |

---

## Phase 2：群聊协作

### 2.1 Planner Service（任务规划）

- [ ] 实现 `PlannerService.generateTaskPlan(input)` 
  - 调用 LLM（Claude Code）生成结构化 `TaskPlan` JSON
  - 定义 `TaskPlan` schema：tasks 数组、依赖关系、agent 分配
- [ ] 实现 `validateTaskPlan(plan)` — JSON Schema 校验
- [ ] 实现降级逻辑：JSON 解析失败重试 1 次 → schema 校验失败重试 1 次 → 降级为单 Agent 直接执行（DirectFallback）

### 2.2 Orchestrator Service（任务调度）

- [ ] 实现 `startOrchestratedRun(input)` — 创建 orchestrated run，调用 Planner，持久化 tasks
- [ ] 实现 DAG 调度器 `scheduleReadyTasks(runId)` — 依赖完成后触发后续任务
- [ ] 实现 `handleTaskCompleted(taskId)` — 任务完成后的状态传播
- [ ] 实现 `aggregateRun(runId)` — 聚合所有 task 结果为一条 Agent 消息
- [ ] 调度规则：
  - 写入范围重叠则串行执行
  - 高风险任务等待用户确认
  - 子任务失败重试 1 次

### 2.3 群聊会话管理

- [ ] 扩展 `conversation_members` 管理：支持添加/移除多个 Agent 成员
- [ ] 实现 @ Agent 功能：用户在输入框中 @ 指定 Agent 来分配任务
- [ ] 群聊创建 UI：新建群聊时选择多个 Agent 参与

### 2.4 Agent 状态与能力展示

- [ ] AgentPicker 组件：支持多选、按能力标签筛选
- [ ] AgentStatusBadge：展示 Agent 在线/离线/忙碌状态
- [ ] CapabilityTags：展示每个 Agent 的能力标签（code-generation, debugging, etc.）
- [ ] AgentConfigDraftCard：展示自建 Agent 的配置草稿确认卡片

### 2.5 协作状态 UI

- [ ] OrchestratorStatusBar：在聊天区顶部展示当前 Run 状态和进度
- [ ] Task 进度展示：每个 task 的 status（queued/running/completed/failed）
- [ ] Tool Invocation 展示：Agent 调用的工具及其结果（内联卡片）
- [ ] 多 Agent 消息区分：不同 Agent 的消息使用不同颜色/头像标识

### 2.6 自建 Agent（对话式创建）

- [ ] ChatService 识别 `create_agent` intent
- [ ] 生成 `AgentConfigDraft`：名称、能力、系统提示词
- [ ] 用户确认后创建 Custom Agent 并加入可用 Agent 列表

---

## Phase 3：产物预览与部署

### 3.1 Workspace Service

- [ ] `ensureWorkspace(conversationId)` — 为会话创建 workspace 目录
- [ ] `createSnapshot(workspaceId, runId, label)` — 生成 before/after 快照
- [ ] `diffSnapshots(beforeId, afterId)` — 计算文件变更
- [ ] `applyFileChange(fileChangeId)` — 应用 Diff
- [ ] `revertFileChange(fileChangeId)` — 回滚 Diff

### 3.2 Artifact Service

- [ ] 完善 `ArtifactService`：从文件变更或输出目录创建 artifact
- [ ] Artifact 卡片组件：
  - DiffCard — Diff 语法高亮展示
  - WebPreviewCard — iframe 网页预览
  - DownloadCard — workspace 打包下载
  - DeployStatusCard — 部署状态

### 3.3 部署基础

- [ ] workspace zip 打包下载
- [ ] 本地静态预览（`local-static`）
- [ ] 部署状态卡片和事件推送

### 3.4 权限与审计

- [ ] SecurityService：secrets 加密存储
- [ ] 高风险命令确认流程
- [ ] 完善 `audit_logs` 写入

---

## Phase 4：体验打磨与交付

### 4.1 稳定性

- [ ] 端到端流程 Bug 修复
- [ ] WebSocket 断线重连 + REST 补齐状态
- [ ] 错误边界和全局错误处理
- [ ] Agent 子进程资源泄漏排查（超时强杀、并发限制、空闲回收）

### 4.2 交互优化

- [ ] 空状态引导（无会话、无消息、无 Agent 时的引导文案）
- [ ] 加载骨架屏
- [ ] 操作反馈（Toast 通知、乐观更新）
- [ ] 键盘快捷键（Ctrl+K 搜索、Ctrl+N 新建会话、Escape 关闭弹窗）

### 4.3 交付物

- [ ] 整理 AI 协作开发记录
- [ ] 编写 3 分钟 Demo 脚本
- [ ] 录制 Demo 视频
- [ ] 部署文档（本地开发环境搭建、技术架构说明）

---

## 后续平台

| 平台 | 启动时机 | 核心工作 |
|---|---|---|
| 桌面端 (Electron/Tauri) | Phase 3 完成后 | 本地 workspace、系统通知、本地 Agent 进程管理 |
| 移动端 (PWA) | Phase 4 完成后 | 轻量查看、审批确认、产物预览 |

---

## 当前阻塞与风险

| 风险 | 状态 | 应对 |
|---|---|---|
| Planner LLM 输出不稳定 | 待验证 | JSON Schema 校验 + 重试 + 降级单 Agent |
| 多 Agent 文件写入冲突 | 待处理 | 写入范围检测、串行化、冲突提示 |
| Codex Adapter 未实现 | 待开发 | Phase 0 已预留接口，Phase 2 需完成接入 |
| 大规模消息列表性能 | 未测试 | 虚拟滚动、分页加载 |
