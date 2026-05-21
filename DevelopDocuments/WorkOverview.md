# AgentHub 工作总览

## 1. 文档定位

本文用于说明 AgentHub 的整体工作范围、阶段划分和交付节奏。  
具体系统架构、模块边界和接口细节以 `DevelopDocuments/` 下的设计文档为准。

简版时间线见：

- `Timeline.md`

详细设计见：

- `AgentHub-web端系统设计.md`
- `AgentHub-web端模块设计.md`
- `AgentHub-桌面端系统设计.md`
- `AgentHub-桌面端模块设计.md`
- `AgentHub-移动端系统设计.md`
- `AgentHub-移动端模块设计.md`

## 2. 项目结构

```text
D:\Projects\MasterOfAgents\
├── AgentHub-_多Agent协作平台设计.pdf
├── DevelopDocuments/
│   ├── WorkOverview.md
│   ├── Timeline.md
│   ├── AgentHub-web端系统设计.md
│   ├── AgentHub-web端模块设计.md
│   ├── AgentHub-桌面端系统设计.md
│   ├── AgentHub-桌面端模块设计.md
│   ├── AgentHub-移动端系统设计.md
│   └── AgentHub-移动端模块设计.md
├── AgentVerse/
└── AgentHub/
    ├── apps/web/
    ├── apps/server/
    └── packages/shared/
```

## 3. 交付物

| 交付物 | 说明 |
|---|---|
| 产品/技术设计文档 | `DevelopDocuments/` 下的系统设计、模块设计、工作总览、时间线 |
| 可运行 Demo | 以 Web 端为主，覆盖单聊、群聊、产物预览和基础部署 |
| AI 协作开发记录 | 记录 Spec、Skill、Rules、关键技术决策 |
| 3 分钟 Demo 视频 | 展示核心链路和产品亮点 |

## 4. 开发阶段
//TODO 
### Phase 0：平台接入验证

目标：

- 初始化 `AgentHub/` 工程。
- 验证 Claude Code 的可编程接入方式。
- 选择并验证第二个平台：Codex 或 OpenCode。
- 跑通统一 `AgentEvent`。
- 确认进程启停、超时、错误处理和并发控制方案。

完成标志：

- 至少一个真实 Agent 平台能稳定接入。
- Claude Code 明确采用 SDK 或 CLI 子进程方案。
- 后续功能可以围绕统一 Agent Adapter 开发。

### Phase 1：Web 单聊闭环

目标：

- 搭建 Web + Server + Shared 的基础工程。
- 完成数据库、REST API、WebSocket 和基础状态管理。
- 实现会话、消息、Agent、Run 的基础能力。
- 完成 1v1 单聊：用户发送消息，Agent 流式回复。
- 支持会话搜索、归档、消息 Pin、引用回复、重新生成。
- 初步记录 workspace 快照和文件变更。

完成标志：

- Web 端可以完成稳定的单聊体验。
- 消息和运行状态可持久化，刷新后可恢复。
- 可以展示基础文件变更或 Diff 产物。

### Phase 2：群聊协作

目标：

- 实现 Planner LLM 生成结构化 TaskPlan。
- 实现 Orchestrator 的任务调度、失败降级和结果聚合。
- 支持群聊成员管理和 @ Agent。
- 展示 Agent 可用状态、能力标签、run/task/tool 状态。
- 支持对话式创建 Custom Agent 的基础流程。

完成标志：

- 群聊中可以分派至少两个 Agent/任务。
- Planner 失败时能降级为单 Agent 执行。
- 前端可以实时展示多 Agent 协作状态。

### Phase 3：产物预览与部署

目标：

- 完善 ArtifactService 和 WorkspaceService。
- 支持 Diff 查看、应用和回滚。
- 支持网页 iframe 预览。
- 支持 workspace 打包下载。
- 支持本地静态预览或基础部署状态卡片。
- 补齐权限审批和审计日志。

完成标志：

- 用户可以查看、应用、回滚 Agent 生成的产物。
- 用户可以获得下载包或本地预览 URL。
- 产物链路可以支撑 Demo 展示。

### Phase 4：体验打磨与交付

目标：

- 修复端到端流程中的稳定性问题。
- 优化聊天流、任务状态、产物卡片和错误提示。
- 整理 AI 协作开发记录。
- 准备并录制 3 分钟 Demo 视频。

完成标志：

- Web 端核心路径可以稳定演示。
- 文档、Demo、协作记录齐备。
- 项目可以用于答辩或展示。

## 5. 后续平台规划

| 平台 | 定位 | 启动时机 |
|---|---|---|
| Web | 主力端，完整 IM + Agent 协作 + 产物操作 | 当前优先 |
| 桌面端 | 本地 workspace、系统通知、本地 Agent 进程管理 | Web 端核心闭环完成后 |
| 移动端 | 查看对话、审批确认、产物预览、轻量回复 | Web 端 Demo 稳定后 |

## 6. 开发记录要求

开发过程中需要沉淀：

- Spec：每个阶段开始前的功能规格。
- Skill：可复用的 AI 协作方法，例如创建 Adapter、添加 WS 事件、扩展消息类型。
- Rules：项目约定，例如 Adapter 不直接操作数据库、WS 中间态必须落库。
- 决策记录：关键技术取舍，例如 Claude Code SDK vs CLI、Planner 降级策略、Sandbox 策略。

## 7. 关键风险

| 风险 | 应对 |
|---|---|
| Claude Code SDK 不稳定 | Phase 0 优先验证，必要时降级 CLI 子进程 |
| Planner 输出不稳定 | JSON schema 校验、重试、降级单 Agent |
| 多 Agent 文件冲突 | 写入范围检测、串行化、冲突提示 |
| WS 断线导致状态丢失 | 所有中间态落库，重连后 REST 补齐 |
| Agent 子进程资源泄漏 | 超时强杀、并发限制、空闲回收 |

