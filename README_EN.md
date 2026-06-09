# AgentHub

Multi-Agent Collaboration Platform — covering **Web / Mobile PWA / Electron Desktop**, with a ChatGPT-style UI.

[中文文档](README.md)

![Web Demo](imgs/web-demo.gif)

## Environment Requirements

| Dependency | Version | Notes |
|---|---|---|
| Node.js | >= 20 | Runtime |
| pnpm | >= 9 | Package manager |
| Claude Code CLI | Latest | **Required** — core Agent runtime |
| Codex / OpenCode CLI | Latest | Optional — second Agent platform |
| Python | >= 3.10 | Optional — needed for PPT generation |
| Git | >= 2.30 | Version control (Agent workspace dependency) |

## Quick Start

```bash
cd AgentHub && pnpm install          # 1. Install dependencies
```

Edit the root `.env` file, choose a Provider and fill in the API Key (supports anthropic / deepseek / dashscope / openai / moonshot / openrouter / glm / dobrain):

```env
PLANNER_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-...
```

```bash
python start-all.py                   # 2. Start all services (Ctrl+C to stop)
```

| Service | Port | Start Script |
|---|---|---|
| Server | 3001 | `python start-server.py` or `pnpm dev:server` |
| Web | 5173 | `python start-web.py` or `pnpm dev:web` |
| Mobile | 5174 | `python start-mobile.py` or `pnpm dev:mobile` |
| Desktop | Electron | `python start-desktop.py` |

All services listen on `0.0.0.0` — phones on the same WiFi can access via LAN IP.

### Manual Start

If the one-click startup script fails, you can start each service manually:

```bash
# Terminal 1: Start backend
cd AgentHub && pnpm dev:server

# Terminal 2: Start Web frontend
cd AgentHub && pnpm dev:web

# Terminal 3: Start mobile (optional)
cd AgentHub && pnpm dev:mobile

# Terminal 4: Start desktop (optional)
cd AgentHub && pnpm dev:desktop
```

Python script equivalents (same functionality, auto port cleanup):

| Script | Equivalent Command | Notes |
|---|---|---|
| `python start-server.py` | `pnpm dev:server` | Start backend (3001), auto-clean port |
| `python start-web.py` | `pnpm dev:web` | Start Web frontend (5173) |
| `python start-mobile.py` | `pnpm dev:mobile` | Start mobile (5174) |
| `python start-desktop.py` | — | Start Electron desktop (dev mode) |

> **Tip**: First-time setup requires `cd AgentHub && pnpm install`. PPT generation additionally requires `pip install -r requirements.txt`.

## Architecture

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
│  Planner (DAG decomposition) + ClaudeCodeAdapter (CLI) │
└─────────────────────────────────────────────────┘
```

## Getting Started

Start a new conversation and chat with your Agents!

![New Conversation](imgs/new-conversation.gif)

## Features

### Chat & Orchestration

Single chat, group chat, @Agent mentions. Planner decomposes tasks + Orchestrator DAG scheduling. Real-time WebSocket streaming for messages and run status. Permission approval interactions. Switch freely between 8 AI Providers.

Supports automatic decomposition of parallel/dependent subtasks with multi-model collaboration.

![Group Chat](imgs/group-chat.gif)

Conversational Agent creation: describe the role in natural language → auto-generate System Prompt with matched tool sets. Manual editing also supported.

![Create Agent](imgs/agent-creation.gif)

View and manage existing Agents, adjust configuration anytime.

![Agent Settings](imgs/agent-settings.gif)

### Workspace

Real-time file tree, VS Code-style code editor, auto-snapshot per Agent run, color-coded Unified Diff (+ green / - red / modified yellow), file change tracking with one-click rollback, draggable panel width (240–600px).

![Workspace](imgs/workspace.gif)

### Artifacts

Supports file / diff / webpage / pptx and other artifact types. Webpage inline iframe preview. PPTX auto-converted to HTML preview player. Artifacts downloadable to local.

![Webpage Generation](imgs/webpage-generation.gif)

Iterate on artifacts through conversation — let Agents refine until satisfied.

![PPT Generation](imgs/ppt-generation.gif)

### Desktop

Electron 33 native window, system notifications, auto-detect Claude Code CLI availability, Workspace local preview server, `pnpm build:portable` for one-click portable build.

![Desktop Demo](imgs/desktop-demo.gif)

### Mobile

PWA + Zustand stack navigation (home → chat → artifact → approval), offline detection, visualViewport keyboard adaptation, directly reuses Web stores / API / hooks and leaf components.

![Mobile Demo](imgs/mobile-demo.gif)

## Common Commands

| Command | Description |
|---|---|
| `python start-all.py` | Start all services at once |
| `pnpm dev:server` / `dev:web` / `dev:mobile` | Start individual services |
| `pnpm build` / `pnpm check` | Build / type check |
| `pnpm build:portable` | One-click desktop packaging |
| `pip install -r requirements.txt` | Python dependencies (PPT generation) |

## Documentation

- [Project Overview & Architecture & Key Decisions](./DevelopDocuments/OVERVIEW.md)
- [Design Showcase (Full Feature Overview)](./DevelopDocuments/DesignShowcase.html)
- [Design Documents](./DevelopDocuments/designs/)
- [AI Collaboration Guidelines (Spec + Rules)](./DevelopDocuments/)
- [Phase Completion Records](./DevelopDocuments/milestones/)
