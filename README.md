# AgentHub

Multi-Agent Collaboration Platform — 多 Agent 协作平台。支持单聊/群聊 Agent 对话、DAG 任务编排、实时流式响应，以及 Workspace 工作区文件管理。

## 环境要求

- **Node.js** >= 20
- **pnpm** >= 9
- **Python** = 3.14（仅启动脚本）

## 快速启动

### 1. 配置 API Key

编辑根目录 `.env` 文件，选择 AI Provider 并填入对应的 API Key：

```env
PLANNER_PROVIDER=anthropic          # 可选: anthropic, deepseek, openai, dashscope, moonshot, openrouter, glm
ANTHROPIC_API_KEY=sk-ant-...        # 选择哪个 Provider 就填哪个 Key
```

支持 8 种 AI Provider 自由切换。不填 Key 则群聊降级为单 Agent 执行，单聊不受影响。

### 2. 一键启动

```bash
python start_dev.py
```

同时启动后端（端口 3001）和前端（端口 5173），浏览器打开 **http://localhost:5173** 即可访问。

### 手动启动

```bash
cd AgentHub
pnpm install
pnpm dev:server   # 终端 1 — 后端 http://localhost:3001
pnpm dev:web      # 终端 2 — 前端 http://localhost:5173
```

手动启动时需自行设置环境变量：`$env:PLANNER_API_KEY = "sk-ant-..."`（PowerShell）或 `export PLANNER_API_KEY=sk-ant-...`（Bash）。

## 架构概览

```
┌─────────────────────────────────────────────────────────┐
│  Browser (React + Vite + Tailwind)  —  port 5173        │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────────┐  │
│  │ Chat UI  │  │Workspace │  │ Artifact / Preview    │  │
│  │ 单聊/群聊 │  │  Panel   │  │ 产物预览 / Diff 内联   │  │
│  └──────────┘  └──────────┘  └───────────────────────┘  │
│        │              │                  │              │
│   WebSocket ◄──── REST API ──────────────►│             │
└────────┼──────────────┼──────────────────┼──────────────┘
         │              │                  │
┌────────┼──────────────┼──────────────────┼─────────────┐
│  Server (Hono + WebSocket + SQLite)  —  port 3001      │
│  ┌──────┴──────┐  ┌──┴──────────┐  ┌───┴────────────┐  │
│  │ Chat/Orch.  │  │  Workspace  │  │  Artifact /    │  │
│  │  Service    │  │  Service    │  │  Deploy        │  │
│  └──────┬──────┘  └──┬──────────┘  └───┬────────────┘  │
│         │            │                 │               │
│  ┌──────┴────────────┴─────────────────┴──────────┐    │
│  │              Agent Adapters                    │    │
│  │  Claude Code  │  Codex CLI  │  (extensible)    │    │
│  └────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────┘
```

## 项目结构

```
├── AgentHub/                          # pnpm workspace
│   ├── apps/
│   │   ├── server/                    #   后端服务 (Hono + SQLite + WebSocket)
│   │   │   └── src/
│   │   │       ├── adapters/          #     Agent 平台适配器 (Claude Code, Codex)
│   │   │       ├── db/                #     数据库 schema / 迁移 / seed
│   │   │       ├── routes/            #     REST API 路由
│   │   │       ├── services/          #     核心服务 (chat, orchestrator, workspace, etc.)
│   │   │       ├── ws/                #     WebSocket 网关 + 连接注册表
│   │   │       └── runtime/           #     进程管理 (supervisor, stream parser)
│   │   └── web/                       #     前端应用 (React + Vite + Tailwind)
│   │       └── src/
│   │           ├── components/
│   │           │   ├── chat/          #     聊天 UI (消息列表、输入框、DiffBlock)
│   │           │   ├── workspace/     #     工作区面板 (文件树、快照、变更)
│   │           │   └── artifact/     #      产物卡片 (网页预览、下载、部署)
│   │           ├── stores/           #      Zustand 状态管理
│   │           ├── hooks/            #      React Hooks
│   │           └── lib/              #      API 客户端、乐观更新、事件总线
│   └── packages/
│       └── shared/                   #     共享类型定义 (DB / WS / 事件 schema)
├── DevelopDocuments/                 #     开发文档
│   ├── designs/                      #     系统 & 模块设计文档
│   ├── milestones/                   #     各阶段完成日志
│   └── todo.md                       #     开发待办事项
├── Test/                             #     默认 Workspace 工作目录
├── start_dev.py                      #     一键启动脚本
└── README.md
```

## 功能

### 对话与协作
- **单聊 / 群聊对话** — 支持与单个 Agent 对话或多 Agent 同时参与
- **DAG 任务编排** — Orchestrator + Planner 拆解任务，生成 DAG 并行/串行调度
- **WebSocket 实时流式响应** — 消息实时推送、运行状态同步
- **权限审批交互** — Agent 执行高危操作前需用户确认
- **Agent @ 提及** — 群聊中 @ 指定 Agent 发言
- **对话式 Agent 创建** — 通过自然语言描述创建自定义 Agent
- **Agent 状态管理与健康检查** — 8 种 AI Provider 自由切换

### Workspace 工作区
- **文件树浏览** — 右侧面板实时展示工作目录文件结构，支持展开/折叠
- **快照管理** — 每次 Agent 运行自动创建快照，支持时间线查看和回滚
- **文件变更追踪** — 变更列表展示 create / modify / delete，支持应用/回滚操作
- **统一 Diff 渲染** — 彩色 unified diff 展示（+ 绿 / - 红 / @@ 蓝），支持折叠/展开
- **文件内容预览** — 新增文件可直接在工作区查看实际内容（二进制检测保护）
- **自定义工作目录** — 创建对话时可指定目录，运行中可手动更改
- **面板可拖拽** — 工作区面板宽度可水平拖拽调整（240px ~ 600px）
- **跨组件联动** — 点击 Agent 回复中的 diff 文件路径，自动定位到工作区变更 Tab

### 产物与部署
- **多类型产物** — 支持 file / diff / webpage / archive 产物类型
- **网页预览** — 生成的网页可在对话流中内联预览
- **文件下载** — 产物文件支持下载
- **本地部署** — 产物可一键部署到 local-static 服务

## 开发状态

| Phase | 内容 | 状态 |
|---|---|---|
| Phase 0–1 | 项目初始化、基础架构、Agent 对话 | ✅ 完成 |
| Phase 2 | DAG 编排、多 Agent 协作、权限审批 | ✅ 完成（Codex CLI 待安装验证） |
| Phase 3 | WebSocket 实时推送、产物管理、部署 | ✅ 完成 |
| Phase 4.2 | Diff 展示完善（真实 diff、彩色渲染、联动） | ✅ 完成 |
| Phase 4.3 | WorkspacePanel 集成（文件树、快照、回滚、拖拽） | ✅ 完成（2 项待验证） |
| Phase 4.1 | Agent 长期记忆能力 | 📋 规划中 |
| Phase 4.4 | Agent 回复富媒体内联展示 | 📋 规划中 |

## 文档

- [开发待办事项](./DevelopDocuments/todo.md)
- [项目时间线](./DevelopDocuments/designs/Timeline.md)
- [系统设计文档](./DevelopDocuments/designs/)
- [阶段性完成日志](./DevelopDocuments/milestones/)
