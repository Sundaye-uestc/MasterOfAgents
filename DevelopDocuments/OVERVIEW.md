# AgentHub 工作总览

**最后更新：** 2026-06-03

## 1. 文档定位

本文记录 AgentHub 的整体工作范围、阶段划分和实际交付情况。  
系统架构、模块边界和接口细节见 `DevelopDocuments/designs/` 下的设计文档。

其他相关文档：

- 各 Phase 完成记录：[milestones/](milestones/)
- 设计文档（`designs/`）：
  - `AgentHub-web端系统设计.md`
  - `AgentHub-web端模块设计.md`
  - `AgentHub-桌面端系统设计.md`
  - `AgentHub-桌面端模块设计.md`
  - `AgentHub-移动端系统设计.md`
  - `AgentHub-移动端模块设计.md`

## 2. 项目结构（当前）

```text
D:\Projects\MasterOfAgents\
├── AgentHub/                          # monorepo 主体
│   ├── apps/server/src/
│   │   ├── adapters/                  # Agent 平台适配器
│   │   │   ├── base.ts               #   统一接口
│   │   │   ├── claude-code.adapter.ts #   Claude Code CLI
│   │   │   └── codex.adapter.ts      #   Codex / OpenCode CLI
│   │   ├── services/                  # 核心服务
│   │   │   ├── agent-runtime.service.ts  # Agent 运行时（snapshot/diff/artifact pipeline）
│   │   │   ├── chat.service.ts           # 对话管理 + buildAgentContext()
│   │   │   ├── workspace.service.ts      # 工作区（快照/回滚/文件树）
│   │   │   ├── artifact.service.ts       # 产物（创建/查询/静态文件服务）
│   │   │   ├── orchestrator.service.ts   # 多 Agent 编排
│   │   │   └── planner.service.ts        # 任务规划
│   │   ├── runtime/                  # 进程管理（ProcessSupervisor + stream-json 解析）
│   │   └── ws/                       # WebSocket 网关 + 连接注册表
│   ├── apps/web/src/
│   │   ├── components/chat/          # 聊天组件
│   │   │   ├── ChatArea.tsx          #   消息区 + runArtifacts 缓存
│   │   │   ├── InlineArtifactCard.tsx #   产物统一分发（webpage/image/text/presentation/download）
│   │   │   ├── InlineDiffCard.tsx    #   文件变更内联卡片（Apply/Revert）
│   │   │   ├── MarkdownContent.tsx   #   Markdown + Diff 代码块渲染
│   │   │   └── DiffBlock.tsx         #   统一 diff 渲染组件
│   │   ├── components/artifact/      # 产物预览组件
│   │   │   ├── WebPreviewCard.tsx    #   iframe 预览（可折叠）
│   │   │   └── TextPreviewCard.tsx   #   文本/代码内联预览（含截断展开）
│   │   └── stores/                   # Zustand 状态管理
│   ├── ppt/                          # PPT 生成脚本（Phase 5）
│   │   ├── generate_ppt.py           #   NanoBanana AI 幻灯片生成
│   │   ├── pptx_to_preview.py        #   PPTX → HTML 预览转换
│   │   ├── styles/                   #   风格模板
│   │   ├── prompts/                  #   提示词模板
│   │   └── templates/                #   HTML 播放器模板
│   └── packages/shared/              # 共享类型（AgentEvent/AgentConfig/…）
├── skills/NanoBanana-PPT-Skills/     # PPT 技能参考（SKILL.md 已精简）
├── DevelopDocuments/                 # 文档 & 里程碑
└── Test/                             # Agent 默认工作目录
```

## 3. 已交付

| 交付物 | 说明 |
|---|---|
| 产品/技术设计文档 | `DevelopDocuments/designs/` 系统 + 模块设计；[OVERVIEW.md](OVERVIEW.md) |
| 可运行 Demo | Web 端覆盖单聊、群聊、产物预览、PPT 内联展示 |
| 各 Phase 完成记录 | [milestones/phase0](milestones/phase0/) — [phase5](milestones/phase5/)共计 6 份 completion 文档 + 验证日志 |
| AI 协作开发记录 | 每阶段的 Spec、Skill、Rules 及关键技术决策已沉淀在各 completion 文档中 |

## 4. 开发阶段（已全部完成）

### Phase 0 ✅ 平台接入验证

→ [phase0-completion.md](milestones/phase0/phase0-completion.md)

- 初始化 `AgentHub/` monorepo（`apps/server`、`apps/web`、`packages/shared`）
- Claude Code CLI 接入验证，流式输出跑通
- 实现 ClaudeCodeAdapter（CLI 子进程方案）
- 最小进程管理：启动、停止、超时、错误捕获
- 输出规范化为统一 `AgentEvent` 流

### Phase 1 ✅ Web 单聊闭环

→ [phase1-completion.md](milestones/phase1/phase1-completion.md)

- 数据库 schema + repositories（SQLite + Drizzle）
- 会话/消息/Agent/Run 基础 CRUD API
- WebSocket 通信（`ws.gateway.ts`）+ 断线恢复
- Web 端聊天主界面（会话列表 + 聊天区 + Agent 选择器）
- 消息持久化、重新生成、Pin 功能
- Workspace 快照 + 文件变更检测
- 用户发消息 → Agent 流式回复 → 前端展示 完整链路

### Phase 2 ✅ 群聊与 Orchestrator

→ [phase2-completion.md](milestones/phase2/phase2-completion.md)

- Planner LLM 生成结构化 `TaskPlan`（含校验 + 失败降级）
- Orchestrator 多 Agent 任务调度与结果聚合
- 群聊成员管理 + @Agent 提及
- 前端 Agent 状态/能力标签/任务进度展示
- 自建 Agent 对话式创建
- CodexAdapter 实现（运行时自动降级为 ClaudeCodeAdapter）

### Phase 3 ✅ 产物预览与部署

→ [phase3-completion.md](milestones/phase3/phase3-completion.md)

- ArtifactService 完成（创建/查询/删除）
- Diff apply/revert 操作
- 网页 iframe 内联预览（WebPreviewCard）
- Workspace 打包下载
- 快照回滚功能

### Phase 4 ✅ 体验完善与稳定性

→ [phase4-completion.md](milestones/phase4/phase4-completion.md)

**4.1 Agent 短期记忆修复**
- `buildAgentContext()` 从 DB 读取对话历史注入 system prompt
- Pinned 消息优先（最多 5 条）+ 4000 字符窗口 + 角色标记
- 群聊 Orchestrator 兼容（Planner 同步填充 `conversationHistory`）

**4.2 Diff 展示完善**
- 服务端真实 unified diff 生成（`diff` npm 包）
- 前端 DiffBlock 统一渲染器：逐行着色 + 折叠展开 + 路径联动
- DiffCard 跨组件联动（点击 → WorkspacePanel 高亮）

**4.3 WorkspacePanel 集成**
- 文件树 API（递归扫描 + 内容读取 + 二进制检测）
- 快照回滚（确认 → 恢复文件 → 树自动刷新）
- 工作目录管理（Agent CWD 修复 + 手动更改 + 新建对话指定）
- 面板拖拽（240–600px）

**4.4 富媒体内联展示**
- InlineDiffCard — 文件变更 per-message 内联，Apply/Revert 按钮
- InlineArtifactCard — 统一分发（webpage / image / text / presentation / download）
- TextPreviewCard — 文本/代码文件内联预览（含截断展开）
- Artifact pipeline 自动创建 + `artifact:created` WS 广播
- ~40 种代码扩展全覆盖 + `text/plain` 兜底

**稳定性修复**
- 服务端 EPIPE 崩溃修复 + crash.log 启动清空
- Agent "思考中" 卡死修复（3 分钟空闲看门狗 + 合成 `run_completed`）
- 前端 FileChange 去重（按 `path::changeType`）
- `tsx watch` 排除 `data/**` 目录防止快照触发重启
- 快照安全防护（深度限制 + 危险目录跳过 + 递归防护）

### Phase 5 ✅ PPT 生成能力集成

→ [phase5-completion.md](milestones/phase5/phase5-completion.md)

- NanoBanana PPT 脚本迁移到 `AgentHub/ppt/`，适配路径解析
- `pptx_to_preview.py` — PPTX → HTML 预览转换器（文本/表格/图片提取 + 自包含播放器）
- Artifact pipeline：`.pptx` MIME 映射 + `shouldSkipFile` 过滤（slide 图片/元数据/JS）
- Agent system prompt：中文输出偏好 + 两种 PPT 生成方式 + 禁止 LibreOffice/COM/子代理审查
- 前端：`isPresentation()` 分发 → 📊 下载卡片；PPTX 预览 → WebPreviewCard iframe
- SKILL.md 精简（675 → 105 行）+ skills 目录清理
- 环境配置合并（GEMINI_API_KEY → 根 `.env`）

## 5. 后续计划

| 计划 | 定位 |
|---|---|
| **Phase 4.5** 用户自建 Agent | 对话式创建 + 自定义 System Prompt + 工具集配置 + 管理界面 |
| **桌面端** | 本地 workspace、系统通知、本地 Agent 进程管理，优先作为 Web UI 桌面壳 |
| **移动端** | PWA 轻量查看：运行状态、审批、简单回复 |

## 6. 关键技术决策（已落地）

| 决策 | 结论 |
|---|---|
| Claude Code 接入方式 | **CLI 子进程**（非 SDK），最稳定可靠 |
| 多 Agent 协作 | Orchestrator + Planner 模式，Planner 生成 TaskPlan → Orchestrator 调度 |
| Planner 降级 | 解析失败/校验不合规时降级为单 Agent 直发 |
| 短期记忆 | `buildAgentContext()` 从 DB 读取历史 → 注入 `--system-prompt`，4000 字符窗口 |
| PPT 生成 | Agent 调用 `generate_ppt.py`（AI 图示）或 `pptxgenjs`（程序化），服务端 `pptx_to_preview.py` 自动生成 HTML 预览 |
| Agent 自审查 | 禁止 Agent 做 LibreOffice/COM/子代理视觉审查，由 artifact pipeline 统一处理预览 |
| Workspace 隔离 | 快照 + manifest + diffSnapshots，run 前后对比检测文件变更 |
| 前端状态 | Zustand store（workspace/ui/chat），WS 驱动刷新 + REST 补齐 |

## 7. 风险回顾

| 风险（规划阶段） | 现状 |
|---|---|
| Claude Code SDK 不稳定 | ✅ 采用 CLI 子进程方案，无 SDK 依赖 |
| Planner 输出不稳定 | ✅ JSON schema 校验 + 重试 + 降级单 Agent |
| 多 Agent 文件冲突 | ✅ 写入范围检测 + 串行化，production 未出现 |
| WS 断线导致状态丢失 | ✅ 所有中间态落库，重连后 REST 补齐 |
| Agent 子进程资源泄漏 | ✅ ProcessSupervisor 超时强杀 + 3 分钟空闲看门狗 + 并发限制 |
| Agent "思考中" 卡死 | ✅ 空闲看门狗 + 合成 `run_completed` 事件兜底 |
