# AgentHub

Multi-Agent Collaboration Platform — 多 Agent 协作平台，覆盖 **Web / 移动端 PWA / Electron 桌面端**，ChatGPT 风格的 UI 设计。

![Web Demo](imgs/web-demo.gif)

## 环境要求

| 依赖 | 版本 | 说明 |
|---|---|---|
| Node.js | >= 20 | 运行时 |
| pnpm | >= 9 | 包管理器 |
| Claude Code CLI | 最新 | **必选**，Agent 运行核心 |
| Codex / OpenCode CLI | 最新 | 可选，第二 Agent 平台 |
| Python | >= 3.10 | 可选，PPT 生成功能需要 |
| Git | >= 2.30 | 版本控制（Agent workspace 依赖） |

## 快速启动

```bash
cd AgentHub && pnpm install          # 1. 安装依赖
```

编辑根目录 `.env`，选择 Provider 并填入 Key（支持 anthropic / deepseek / dashscope / openai / moonshot / openrouter / glm / dobrain）：

```env
PLANNER_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-...
```

```bash
python start-all.py                   # 2. 一键启动全部服务 (Ctrl+C 停止)
```

| 服务 | 端口 | 启动脚本 |
|---|---|---|
| Server | 3001 | `python start-server.py` 或 `pnpm dev:server` |
| Web | 5173 | `python start-web.py` 或 `pnpm dev:web` |
| Mobile | 5174 | `python start-mobile.py` 或 `pnpm dev:mobile` |
| Desktop | Electron | `python start-desktop.py` |

所有服务监听 `0.0.0.0`，手机同 WiFi 可通过局域网 IP 访问。

### 手动启动

如果一键脚本启动失败，也可以逐个手动启动：

```bash
# 终端 1：启动后端
cd AgentHub && pnpm dev:server

# 终端 2：启动 Web 前端
cd AgentHub && pnpm dev:web

# 终端 3：启动移动端（可选）
cd AgentHub && pnpm dev:mobile

# 终端 4：启动桌面端（可选）
cd AgentHub && pnpm dev:desktop
```

Python 脚本方式（功能等价，自动处理端口清理）：

| 脚本 | 等价命令 | 说明 |
|---|---|---|
| `python start-server.py` | `pnpm dev:server` | 启动后端 (3001)，自动清理端口占用 |
| `python start-web.py` | `pnpm dev:web` | 启动 Web 前端 (5173) |
| `python start-mobile.py` | `pnpm dev:mobile` | 启动移动端 (5174) |
| `python start-desktop.py` | — | 启动 Electron 桌面端 (dev 模式) |

> **提示**：首次使用需先 `cd AgentHub && pnpm install` 安装依赖，PPT 生成功能需额外执行 `pip install -r requirements.txt`。

## 架构

```
┌───────────┐  ┌──────────┐  ┌──────────────┐
│ Web (5173)│  │Mob (5174)│  │Desktop (Elec)│  React 19 + Vite 6 + Tailwind 4
└─────┬─────┘  └─────┬────┘  └───────┬──────┘
      └──────────────┼───────────────┘
                     │  REST + WebSocket
┌────────────────────┼────────────────────────────┐
│  Server (Hono + sql.js + ws) :3001              │
│  Routes ←→ Services ←→ Adapters                 │
│  Chat / Orchestrator / Workspace / Artifact     │
│  Planner (DAG 拆解) + ClaudeCodeAdapter (CLI)   │
└─────────────────────────────────────────────────┘
```

## 开始

新建一个对话，开始与Agent们聊天吧！

![New Conversation](imgs/new-conversation.gif)

## 功能

### 对话与编排

单聊、群聊、@Agent 提及，Planner 拆解任务 + Orchestrator DAG 调度，WebSocket 实时流式推送消息与运行状态，权限审批交互，支持 8 种 AI Provider 自由切换。

支持并行/依赖子任务的自动拆解与完成，融合多模型协同工作。

![Group Chat](imgs/group-chat.gif)

对话式创建 Agent：用自然语言描述角色 → 自动生成 System Prompt 并匹配工具集，也可手动编辑配置。

![Create Agent](imgs/agent-creation.gif)

支持查看与管理已有 Agent，可随时调整配置。

![Agent Settings](imgs/agent-settings.gif)

### Workspace

实时文件树、VS Code风格的代码编辑器、每次 Agent 运行自动快照、彩色 Unified Diff（+ 绿 / - 红 / 修改 黄）、文件变更追踪与一键回滚、面板宽度可拖拽（240–600px）。

![Workspace](imgs/workspace.gif)

### 产物

支持 file / diff / webpage / pptx 等多类型产物。网页 iframe 内联预览，PPTX 自动转换为 HTML 预览播放器，产物可下载到本地。

![Webpage Generation](imgs/webpage-generation.gif)

通过对话让 Agent 反复完善产物，迭代至满意为止。

![PPT Generation](imgs/ppt-generation.gif)

### 桌面端

Electron 33 原生窗口，系统通知，自动检测 Claude Code CLI 可用性，Workspace 本地预览服务器，`pnpm build:portable` 一键打包免安装版。

![Desktop Demo](imgs/desktop-demo.gif)

### 移动端

PWA + Zustand stack 导航（home → chat → artifact → approval），离线检测，visualViewport 键盘适配，直接复用 Web 端 stores / API / hooks 与叶子组件。

![Mobile Demo](imgs/mobile-demo.gif)

## 常用命令

| 命令 | 说明 |
|---|---|
| `python start-all.py` | 一键启动全部服务 |
| `pnpm dev:server` / `dev:web` / `dev:mobile` | 单独启动各服务 |
| `pnpm build` / `pnpm check` | 构建 / 类型检查 |
| `pnpm build:portable` | 桌面端一键打包 |
| `pip install -r requirements.txt` | Python 依赖（PPT 生成） |

## 文档

- [工作总览 & 项目结构 & 技术决策](./DevelopDocuments/OVERVIEW.md)
- [设计展示页（全功能一览）](./DevelopDocuments/DesignShowcase.html)
- [项目设计文档](./DevelopDocuments/designs/)
- [AI 协作规范（Spec + Rules）](./DevelopDocuments/)
- [各阶段完成记录](./DevelopDocuments/milestones/)
