# AgentHub 工作总览

**最后更新：** 2026-06-07

## 1. 文档定位

本文记录 AgentHub 的整体工作范围、阶段划分和实际交付情况。  
系统架构、模块边界和接口细节见 `DevelopDocuments/designs/` 下的设计文档。

其他相关文档：

- 各 Phase 完成记录：[milestones/](milestones/)
- 待办事项：[todo.md](todo.md)
- 设计文档（`designs/`）：
  - `AgentHub-web端系统设计.md` · `AgentHub-web端模块设计.md`
  - `AgentHub-桌面端系统设计.md` · `AgentHub-桌面端模块设计.md`
  - `AgentHub-移动端系统设计.md` · `AgentHub-移动端模块设计.md`

## 2. 项目结构（当前）

```text
D:\Projects\MasterOfAgents\
├── AgentHub/                              # pnpm monorepo
│   ├── apps/
│   │   ├── server/src/                    # Hono REST + WebSocket 后端
│   │   │   ├── adapters/                  #   Agent 平台适配器
│   │   │   │   ├── base.ts               #     统一接口
│   │   │   │   ├── claude-code.adapter.ts #     Claude Code CLI
│   │   │   │   └── codex.adapter.ts       #     Codex / OpenCode CLI
│   │   │   ├── services/                  #   核心服务
│   │   │   │   ├── agent-runtime.service.ts  # Agent 运行时（snapshot/diff/artifact pipeline）
│   │   │   │   ├── chat.service.ts           # 对话管理 + buildAgentContext()
│   │   │   │   ├── workspace.service.ts      # 工作区（快照/回滚/文件树）
│   │   │   │   ├── artifact.service.ts       # 产物（创建/查询/静态文件服务）
│   │   │   │   ├── orchestrator.service.ts   # 多 Agent 编排
│   │   │   │   └── planner.service.ts        # 任务规划
│   │   │   ├── runtime/                  #   进程管理（ProcessSupervisor + stream-json）
│   │   │   └── ws/                       #   WebSocket 网关 + 连接注册表
│   │   ├── web/src/                      # React Web 前端 (Vite, 端口 5173)
│   │   │   ├── components/chat/          #   聊天组件（ChatArea, MarkdownContent, DiffBlock…）
│   │   │   ├── components/artifact/      #   产物预览（WebPreviewCard, TextPreviewCard…）
│   │   │   └── stores/                   #   Zustand 状态管理
│   │   ├── mobile/src/                   # React PWA 移动端 (Vite, 端口 5174)
│   │   │   ├── pages/                    #   页面（ConversationList, Chat, Approval, Artifact…）
│   │   │   ├── components/               #   移动端组件（MessageInput, RunStatusBanner…）
│   │   │   ├── stores/                   #   mobile-ui.store（Zustand stack 导航）
│   │   │   └── hooks/                    #   useNetworkStatus…
│   │   └── desktop/src/                  # Electron 桌面端
│   │       ├── main/                     #   Main process（index, server-lifecycle, ipc-handlers,
│   │       │                             #     cli-detection, notification, preview-server）
│   │       └── preload/                  #   contextBridge preload
│   ├── packages/shared/                  # 共享类型（AgentEvent/AgentConfig/Schema…）
│   ├── ppt/                              # PPT 生成脚本
│   └── scripts/                          # build-portable.mjs 一键打包
├── start-server.py                       # 启动后端 (端口 3001)
├── start-web.py                          # 启动 Web 前端 (端口 5173)
├── start-mobile.py                       # 启动移动端 (端口 5174)
├── start-desktop.py                      # 启动桌面端 (Electron dev mode)
├── DevelopDocuments/                     # 文档 & 里程碑
└── Test/                                 # Agent 默认工作目录
```

## 3. 已交付

| 交付物 | 说明 |
|---|---|
| 产品/技术设计文档 | 6 份系统 + 模块设计文档（Web / 桌面 / 移动各 2 份） |
| 可运行 Demo | Web 端 + 移动端 + 桌面端全覆盖 |
| 各 Phase 完成记录 | Web 7 份 (phase0-6) + 桌面 4 份 (phase1-4) + 移动 2 份 (phase1-2) |
| 一键构建脚本 | `pnpm build:portable` → 编译 + 打包 + 部署（~29s） |
| 开发启动脚本 | 4 个 `start-*.py`，一键启动各服务（均监听 `0.0.0.0`，局域网可访问） |
| AI 协作开发记录 | 每阶段的 Spec、Skill、Rules 及关键技术决策已沉淀在各 completion 文档中 |

## 4. 开发阶段（已全部完成）

### Web 端

#### Phase 0 ✅ 平台接入验证

→ [phase0-completion.md](milestones/web/phase0/phase0-completion.md)

- 初始化 `AgentHub/` monorepo（`apps/server`、`apps/web`、`packages/shared`）
- Claude Code CLI 接入验证，流式输出跑通
- 实现 ClaudeCodeAdapter（CLI 子进程方案）
- 最小进程管理：启动、停止、超时、错误捕获
- 输出规范化为统一 `AgentEvent` 流

#### Phase 1 ✅ Web 单聊闭环

→ [phase1-completion.md](milestones/web/phase1/phase1-completion.md)

- 数据库 schema + repositories（SQLite + Drizzle）
- 会话/消息/Agent/Run 基础 CRUD API
- WebSocket 通信（`ws.gateway.ts`）+ 断线恢复
- Web 端聊天主界面（会话列表 + 聊天区 + Agent 选择器）
- 消息持久化、重新生成、Pin 功能
- Workspace 快照 + 文件变更检测
- 用户发消息 → Agent 流式回复 → 前端展示 完整链路

#### Phase 2 ✅ 群聊与 Orchestrator

→ [phase2-completion.md](milestones/web/phase2/phase2-completion.md)

- Planner LLM 生成结构化 `TaskPlan`（含校验 + 失败降级）
- Orchestrator 多 Agent 任务调度与结果聚合
- 群聊成员管理 + @Agent 提及
- 前端 Agent 状态/能力标签/任务进度展示
- 自建 Agent 对话式创建
- CodexAdapter 实现（运行时自动降级为 ClaudeCodeAdapter）

#### Phase 3 ✅ 产物预览与部署

→ [phase3-completion.md](milestones/web/phase3/phase3-completion.md)

- ArtifactService 完成（创建/查询/删除）
- Diff apply/revert 操作
- 网页 iframe 内联预览（WebPreviewCard）
- Workspace 打包下载
- 快照回滚功能

#### Phase 4 ✅ 体验完善与稳定性

→ [phase4-completion.md](milestones/web/phase4/phase4-completion.md)

- Agent 短期记忆修复（`buildAgentContext()` + 4000 字符窗口）
- Diff 展示完善（unified diff + DiffBlock 渲染器 + 跨组件联动）
- WorkspacePanel 集成（文件树 API + 快照回滚 + 面板拖拽）
- 富媒体内联展示（InlineDiffCard / InlineArtifactCard / TextPreviewCard）
- 稳定性修复（EPIPE 崩溃、Agent 卡死看门狗、FileChange 去重）

#### Phase 5 ✅ PPT 生成能力集成

→ [phase5-completion.md](milestones/web/phase5/phase5-completion.md)

- NanoBanana PPT 脚本迁移到 `AgentHub/ppt/`
- `pptx_to_preview.py` — PPTX → HTML 预览转换器
- Artifact pipeline：`.pptx` MIME 映射 + 过滤规则
- 前端：isPresentation() 分发 + WebPreviewCard iframe
- 环境配置合并（GEMINI_API_KEY → 根 `.env`）

#### Phase 6 ✅ Agent 管理与 Planner 修复

→ [phase6-completion.md](milestones/web/phase6/phase6-completion.md)

- Agent 管理 CRUD（对话式创建 + System Prompt 编辑/AI 润色 + 工具集匹配）
- Planner 修复（ESM hoisting API Key、Prompt 强化、DAG 调度验证、上下文隔离）
- PPT 文件变更白名单、能力标签 emoji fallback、文件预览去重

---

### 桌面端

#### Phase 1 ✅ Electron Shell + Server Lifecycle

→ [phase1-completion.md](milestones/desktop/phase1/phase1-completion.md)

- Electron 33 窗口管理（Main/Renderer 双进程）
- BrowserWindow 加载 Web UI（开发期连 Vite，打包期代理本地 server）
- Server 子进程生命周期管理（start/stop/status + 端口探测 + 30s 超时）
- IPv4/IPv6 双栈端口检测
- Dev 模式 wrapper（`electron-dev.js` 解决 ELECTRON_RUN_AS_NODE 冲突）

#### Phase 2 ✅ IPC Bridge + Workspace Selection + CLI Detection

→ [phase2-completion.md](milestones/desktop/phase2/phase2-completion.md)

- 完整 IPC 桥接框架（ipc-handlers + preload contextBridge）
- 原生文件夹选择器（`dialog.showOpenDialog`）
- 最近 workspace 路径持久化
- Claude Code CLI 可用性检测（`claude --version`）

#### Phase 3 ✅ System Notifications + Local Preview Server

→ [phase3-completion.md](milestones/desktop/phase3/phase3-completion.md)

- Electron Notification API 封装 + Windows appUserModelId
- 本地预览服务：workspace 目录静态文件 HTTP server（127.0.0.1）
- 支持 HTML、图片、前端构建输出等类型

#### Phase 4 ✅ Packaging + Build Script + Portable Deploy

→ [phase4-completion.md](milestones/desktop/phase4/phase4-completion.md)

- electron-builder 配置（`--dir` 目标、asarUnpack、extraResources）
- @agenthub/shared workspace 注入到 unpacked node_modules
- server/node_modules junction 桥接（ESM 模块解析）
- 一键构建脚本 `scripts/build-portable.mjs`（`pnpm build:portable`，~29s）
- 便携版启动器 `启动AgentHub.bat`（清除 ELECTRON_RUN_AS_NODE）

---

### 移动端

#### Phase 1 ✅ MVP 全功能

→ [phase1-completion.md](milestones/mobile/phase1/phase1-completion.md)

- 脚手架：monorepo `apps/mobile/`，复用 web 端 stores/API/hooks/叶子组件
- Zustand stack 导航（home → chat → artifact/approval/settings）
- 网络检测（online/offline + ping）+ OfflinePage
- 会话列表（搜索、新建、左滑操作）
- 聊天页（消息列表、气泡、日期分隔、Pinned 上下文）
- WebSocket 实时状态同步（message:delta/completed、run:status、task:*、tool:invocation…）
- 消息发送（visualViewport 键盘适配、@提及、乐观更新）
- Run 停止 + 运行状态展示（RunStatusBanner、TaskProgress、ToolInvocation）
- 审批面板（Diff apply/revert）
- Artifact 预览（网页/文本/PPT/文件 按类型渲染）

#### Phase 2 ✅ 产物预览增强 + 文件变更确认 + UI 优化

→ [phase2-completion.md](milestones/mobile/phase2/phase2-completion.md)

- 消息内联产物预览（复用 web 端卡片组件）
- 文件变更确认弹窗（run 结束后聊天页顶部弹出，支持 apply/revert）
- 成员信息面板（底部弹出 Agent 列表 + 能力标签）
- 触觉反馈（longPress + selectionChange）
- UI 细节优化（消息气泡圆角/间距、输入栏阴影、动画过渡）

## 5. 后续计划

| 计划 | 定位 |
|---|---|
| **移动端 PWA 构建修复** | vite-plugin-pwa precaching 配置修复 |
| **winCodeSign 根治** | 开启 Windows 开发者模式 或 升级 electron-builder，消除 7za symlink workaround |
| **桌面端代码签名** | 正式发布前需配置 Windows 代码签名证书 |
| **CI/CD** | 自动化构建 + 测试 + 发布流水线 |

## 6. 关键技术决策（已落地）

| 决策 | 结论 |
|---|---|
| **Claude Code 接入方式** | **CLI 子进程**（非 SDK），最稳定可靠 |
| **多 Agent 协作** | Orchestrator + Planner 模式，Planner 生成 TaskPlan → Orchestrator 调度 |
| **Planner 降级** | 解析失败/校验不合规时降级为单 Agent 直发 |
| **短期记忆** | `buildAgentContext()` 从 DB 读取历史 → 注入 `--system-prompt`，4000 字符窗口 |
| **PPT 生成** | Agent 调用 `generate_ppt.py`（AI 图示）或 `pptxgenjs`（程序化），服务端 `pptx_to_preview.py` 自动生成 HTML 预览 |
| **Agent 自审查** | 禁止 Agent 做 LibreOffice/COM/子代理视觉审查，由 artifact pipeline 统一处理预览 |
| **Workspace 隔离** | 快照 + manifest + diffSnapshots，run 前后对比检测文件变更 |
| **前端状态** | Zustand store（workspace/ui/chat），WS 驱动刷新 + REST 补齐 |
| **桌面端架构** | Electron 33 双进程，Main process 管理 server 子进程 + IPC 桥接，Renderer 加载 Web UI |
| **桌面端打包** | electron-builder `--dir` 目标、asarUnpack 提取 node_modules、workspace 包手动注入、directory junction 桥接 ESM |
| **移动端架构** | PWA + Vite 6，Zustand stack 导航（无 router），复用 web stores/API/hooks/叶子组件 |
| **移动端导航** | Zustand stack（push/pop/goHome），与 web 端 useState 条件渲染模式一致，适合 3-4 级页面深度 |
| **跨端复用** | web package.json `exports` 字段暴露 stores/lib/hooks/components，mobile 通过 `@agenthub/web: workspace:*` 直接引用 |
| **局域网访问** | 所有服务监听 `0.0.0.0`，手机同 WiFi 可通过局域网 IP 访问移动端/Web 端 |

## 7. 风险回顾

| 风险（规划阶段） | 现状 |
|---|---|
| Claude Code SDK 不稳定 | ✅ 采用 CLI 子进程方案，无 SDK 依赖 |
| Planner 输出不稳定 | ✅ JSON schema 校验 + 重试 + 降级单 Agent |
| 多 Agent 文件冲突 | ✅ 写入范围检测 + 串行化，production 未出现 |
| WS 断线导致状态丢失 | ✅ 所有中间态落库，重连后 REST 补齐 |
| Agent 子进程资源泄漏 | ✅ ProcessSupervisor 超时强杀 + 3 分钟空闲看门狗 + 并发限制 |
| Agent "思考中" 卡死 | ✅ 空闲看门狗 + 合成 `run_completed` 事件兜底 |
| Electron winCodeSign 兼容性 | ✅ `--dir` workaround 可用，根治需开发者模式 |
| 移动端 PWA 离线缓存 | ✅ vite-plugin-pwa precaching 待修复 |
| asar 文件锁定 | ✅ Windows 系统进程偶尔锁定，重启后可替换 |
