# AgentHub

Multi-Agent Collaboration Platform — 多 Agent 协作平台。

## 环境要求

- **Node.js** >= 20
- **pnpm** >= 9
- **Python** >= 3.8（仅启动脚本）

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

## 项目结构

```
├── AgentHub/                    # pnpm workspace
│   ├── apps/
│   │   ├── server/              #   后端服务 (Hono + SQLite + WebSocket)
│   │   └── web/                 #   前端应用 (React + Vite + Tailwind)
│   └── packages/
│       └── shared/              #   共享类型定义
├── DevelopDocuments/            # 开发文档与设计
├── start_dev.py                 # 一键启动脚本
└── README.md
```

## 功能

- 单聊/群聊 Agent 对话
- DAG 任务编排与多 Agent 协作 (Orchestrator + Planner)
- WebSocket 实时流式响应
- 权限审批交互流程
- 对话式自定义 Agent 创建
- Agent 多选与 @ 提及

## 文档

- [开发待办事项](./DevelopDocuments/todo.md)
- [Phase 2 完成日志](./DevelopDocuments/log/phase2/phase2-completion.md)
