# AgentHub 开发时间线

## Phase 0：项目骨架与平台接入验证

目标：先确认 Agent 平台是否能被稳定接入，避免后续架构建立在不确定能力上。

主要工作：

- 初始化 `AgentHub/` monorepo。
- 搭建 `apps/server`、`apps/web`、`packages/shared` 基础结构。
- 验证 Claude Code 的可编程接入方式。
- 跑通 Claude Code Adapter 的流式输出。
- 选择并验证第二个平台：Codex 或 OpenCode。
- 实现最小版进程管理：启动、停止、超时、错误捕获。

完成标志：

- 至少 1 个平台 Agent 能稳定输出统一事件流。
- 明确 Claude Code 使用 SDK 还是 CLI 子进程方案。
- 后续开发可以围绕统一 `AgentEvent` 继续推进。

## Phase 1：Web 单聊闭环

目标：完成 Web 端最小可用聊天体验。

主要工作：

- 建立数据库 schema 和基础 repositories。
- 实现会话、消息、Agent、Run 的基础 API。
- 实现 WebSocket 通信和断线恢复。
- 搭建 Web 端聊天主界面。
- 支持会话搜索、归档、消息 Pin、引用回复、重新生成。
- 跑通用户发送消息到 Agent 流式回复的完整链路。
- 记录 workspace 快照和文件变更。

完成标志：

- 用户可以在 Web 端创建会话并与 Agent 单聊。
- Agent 回复可流式展示并持久化。
- 刷新页面后消息和运行状态可恢复。
- 可以看到基础文件变更或 Diff 产物。

## Phase 2：群聊与 Orchestrator

目标：实现多 Agent 协作的核心能力。

主要工作：

- 实现 Planner LLM 生成结构化 `TaskPlan`。
- 实现 TaskPlan 校验和失败降级。
- 实现 Orchestrator 的任务调度与聚合。
- 支持群聊成员管理和 @ Agent。
- 前端展示 Agent 状态、能力标签、任务进度。
- 初步支持自建 Agent 的对话式创建流程。

完成标志：

- 群聊中可以由 Orchestrator 分派至少 2 个任务。
- 前端能实时展示 run/task/tool 状态。
- Planner 失败时可以降级为单 Agent 执行。
- 新建 Agent 能出现在 AgentPicker 中。

## Phase 3：产物预览与部署

目标：让 Agent 产出可查看、可应用、可交付。

主要工作：

- 完善 ArtifactService。
- 支持 Diff apply/revert。
- 支持网页 iframe 预览。
- 支持 workspace 打包下载。
- 支持本地静态预览或轻量部署状态卡片。
- 补齐部署相关审批和状态更新。

完成标志：

- 用户可以查看 Agent 生成的网页或文件产物。
- 用户可以应用或回滚 Diff。
- 用户可以下载产物包或获得本地预览 URL。

## Phase 4：体验完善与 Demo 准备

目标：把 MVP 打磨成可演示版本。

主要工作：

- 修复端到端流程中的稳定性问题。
- 优化消息流、任务状态、产物卡片的交互。
- 补充错误提示、空状态、加载状态。
- 整理 AI 协作开发记录。
- 准备 3 分钟 Demo 脚本。
- 录制 Demo 视频。

完成标志：

- Web 端核心路径可以稳定演示。
- 文档、Demo、协作记录齐备。
- 项目具备答辩说明所需的架构和实现材料。

## 后续扩展

桌面端：

- 接入本地 workspace、系统通知、安全存储和本地 Agent 进程管理。
- 优先作为 Web UI 的桌面壳运行。

移动端：

- 以 PWA 为主。
- 只做轻量查看、运行状态、审批和简单回复。

