# Phase 4 开发完成文档

**完成日期：** 2026-05-31（更新于 2026-06-02：4.1 短期记忆修复）

---

## 概述

完成 Phase 3 遗留基础设施模块 + Phase 4.1 Agent 短期记忆修复 + Phase 4.2 Diff 展示完善 + Phase 4.3 WorkspacePanel 集成完善。打通了从服务端 workspace → store → UI 的完整数据链路，新增快照回滚、文件内容查看、面板拖拽、工作目录管理等功能，并修复了 Agent 无法感知对话上下文的严重缺陷。

---

## 一、Phase 3 遗留项

### 1.1 服务端：WS 连接注册表

**文件：** `apps/server/src/ws/connection-registry.ts`（新建）

- `ConnectionRegistry` 类：管理 WebSocket 连接生命周期（register / unregister / joinRoom / leaveRoom / getRoom）
- 单例导出，集成到 `gateway.ts`

### 1.2 前端：乐观更新工具

**文件：** `apps/web/src/lib/optimistic-updates.ts`（新建）

- `optimisticUpdate()` — 通用乐观写入 + 失败回滚
- `createOptimisticExecutor()` — React 组件级封装

---

## 二、Phase 4.1 Agent 短期记忆修复（2026-06-02）

### 2.1 缺陷现象

Agent 每次收到新消息时，只看到当前消息本身，完全不知道对话历史。例如用户先问"写一个 hello world"，再问"把输出改成中文"，Agent 不知道前面写过什么。

### 2.2 根因分析

1. `chat.service.ts` / `agent-runtime.service.ts` 调用 adapter 时只传了 `prompt: body.content`（当前消息），未构建历史上下文
2. `adapter.run()` 使用 `-p "当前消息"` 启动子进程，适配器不加载数据库中的历史消息
3. `--no-session-persistence` flag 禁用了 CLI 层的会话持久化，确保每次运行从零开始
4. `PlannerService.buildPlannerPrompt()` 虽定义了 `conversationHistory?` 字段，但无调用方填充

### 2.3 修复方案

**核心思路：** 每次 Agent run 启动时，从 DB 加载同 conversation 的历史消息，注入到 `--system-prompt` 中，使 Agent 感知完整对话上下文。

**数据流：**

```
用户发送消息
  → agent-runtime.service.ts startDirectRun()
    → chatService.buildAgentContext(conversationId)
      → 查询 messages 表（按 createdAt 排序）
      → pinned 消息优先注入（最多 5 条）
      → 最近 20 条普通消息（排除当前 prompt）
      → 4000 字符上限截断
      → 返回 [{ role, content }, ...]
    → adapter.run({ prompt, messageHistory, ... })
      → claude-code.adapter.ts / codex.adapter.ts
        → 格式化为 [用户] / [AI助手] 标记的对话历史
        → 注入 --system-prompt
```

### 2.4 修改文件清单

| 文件 | 变更 |
|---|---|
| `adapters/base.ts` | `RunInput` 新增 `messageHistory?: { role, content }[]` 字段 |
| `chat.service.ts` | 新增 `buildAgentContext()` — 从 DB 读历史 + pinned 优先 + 截断 |
| `agent-runtime.service.ts` | `startDirectRun()` 调用 `buildAgentContext()` 并传入 `adapter.run()` |
| `claude-code.adapter.ts` | 将 `messageHistory` 格式化为对话历史注入 `--system-prompt` |
| `codex.adapter.ts` | 同样的历史注入逻辑（与 Claude Code adapter 一致） |
| `orchestrator.service.ts` | 群聊路径调用 `buildAgentContext()` 填充 `PlannerInput.conversationHistory` |

### 2.5 关键约束

- **上下文窗口限制：** 4000 字符硬截断，保证不超出 CLI 限制
- **pinned 优先：** 已 pin 的消息必定注入，最多 5 条
- **历史角色标记：** `[用户]` / `[AI助手]` 清晰区分发言人
- **排除当前消息：** `normal.slice(-maxMessages, -1)` 避免重复发送当前 prompt
- **群聊兼容：** Orchestrator 调用 Planner 时同步填充 `conversationHistory`

---

## 三、Phase 4.2 对话中 Diff 展示完善

### 2.1 服务端：真实 unified diff 生成

- 安装 `diff` npm 包
- `createSnapshot()` 在 `data/snapshots/<id>/` 下存储文件副本
- `_generateDiff()` 使用 `diffLib.createPatch()` 生成真正 unified diff
- `deleteSnapshot()` 清理快照目录

### 2.2 前端：DiffBlock 统一 diff 渲染

**文件：** `apps/web/src/components/chat/DiffBlock.tsx`（新建）

- 逐行着色：`+` 绿 / `-` 红 / `@@` 蓝 / 上下文灰
- 超过 20 行默认折叠，可展开/收起
- 文件路径头部可点击 → 触发 WorkspacePanel 联动定位

### 2.3 前端：MarkdownContent 内联 Diff

**文件：** `apps/web/src/components/chat/MarkdownContent.tsx`

- `` ```diff `` 代码块使用 `<DiffBlock>` 渲染

### 2.4 前端：DiffCard + 跨组件联动

- `DiffCard.tsx` 使用 `<DiffBlock>` 替代纯文本
- `ui.store.ts` 新增 `selectedChangePath` / `selectChangePath`
- `WorkspacePanel.tsx` 监听 → 自动切换变更 Tab + 蓝色光环高亮

---

## 四、Phase 4.3 WorkspacePanel 集成完善

### 3.1 服务端：文件树 API

- `buildFileTree(rootPath)` — 递归目录扫描，返回 `FileNode[]`
- `GET /api/workspaces/:id/files` — 文件树端点
- `GET /api/workspaces/browse?path=` — 通用目录浏览
- `PATCH /api/workspaces/:id` — 更新 rootPath

### 3.2 前端：Store 集成 + 面板功能

- `workspace.store.ts` — `load()` 加载文件树/快照/变更；`updateRootPath()` 更改目录；`refresh()` 刷新数据
- `App.tsx` — 接入 `useWorkspaceStore` / `useUIStore`，面板折叠/展开/拖拽
- `ChatArea.tsx` — 移除重复 state，WS 事件驱动刷新
- `WorkspacePanel.tsx` — 内联组件替换、面板切换、文件选择、目录更改

### 3.3 快照回滚

- `WorkspaceService.rollbackToSnapshot()` — 清空工作区 → 从快照复制文件
- `POST /api/workspaces/:id/snapshots/:snapshotId/rollback`
- `SnapshotList.tsx` — 回滚按钮 + 二次确认

### 3.4 新增文件内容查看

- `WorkspaceService.readFileContent()` — 文本内容读取 + 二进制检测 + 路径安全校验 + 大小限制
- `GET /api/workspaces/:id/file-content?path=`
- `DiffCard.tsx` — `FileContentViewer` 子组件，合成 unified diff 通过 DiffBlock 渲染

### 3.5 工作目录管理

- Agent 工作目录修复：`workingDir: workspaceRootPath`（原为 `process.cwd()`）
- 默认工作目录：`D:\Projects\MasterOfAgents\Test`
- 手动更改工作目录：文本输入方式
- 新建对话指定工作目录：创建弹窗中可选填写

### 3.6 面板交互

- 面板宽度拖拽调整（240px–600px）
- WS 事件驱动的 workspace 刷新

---

## 关键架构决策

| 决策 | 说明 |
|---|---|
| `buildAgentContext()` 注入短期记忆 | 每次 run 从 DB 读取历史 → system prompt，4000 字符截断 |
| workspace.store 作为单一数据源 | 文件树、快照、变更仅由 store 管理 |
| ui.store 管理面板状态 | 扩展支持 selectedChangePath 跨组件通信 |
| DiffBlock 为统一 diff 渲染器 | MarkdownContent 和 DiffCard 共享 |
| 快照文件副本存储 | `data/snapshots/<id>/` 支持 diff 和回滚 |
| WS 事件驱动刷新 | run:started/run:completed/file:changed 触发 store 更新 |

---

## 验证结果

- TypeScript 编译：server ✅ / web ✅（零错误）
- **4.1 短期记忆：** agent 能感知对话历史（`buildAgentContext()` → system prompt），群聊 Planner 同步填充 `conversationHistory`
- 数据链路：store.load() → API → WorkspacePanel 三 Tab 渲染
- 快照回滚：确认后恢复文件 → 文件树自动刷新
- Diff 渲染：`+` 绿 / `-` 红 / `@@` 蓝 / 长 diff 折叠
- 联动：点击 diff 路径 → WorkspacePanel 变更 Tab + 高亮
- 面板拖拽：240–600px，实时调整
