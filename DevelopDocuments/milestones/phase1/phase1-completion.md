# Phase 1 完成日志

**日期：** 2026-05-22
**状态：** 已完成 — 后端 + 前端完整闭环，Bug 修复完毕，UX 打磨到位

---

## 概述

Phase 1（Web 单聊闭环）已成功完成。用户可通过 Web 界面创建会话并选择 Agent（Claude Code / Codex），发送消息后 Agent 流式回复，所有数据持久化到 SQLite。经过多轮 UX 打磨，前端交互已接近产品级体验。

## 关键决策

| 决策项 | 选择 | 理由 |
|---|---|---|
| 数据库 | SQLite + Drizzle ORM (sql.js 驱动) | sql.js 纯 JS 实现，无需原生编译 |
| WebSocket | `ws` 库挂载到 Hono Node Server | 成熟稳定，直接挂载到 HTTP Server |
| ID 生成 | `node:crypto.randomUUID()` | 无需额外依赖 |
| 前端代理 | Vite proxy (`/api` → 3001, `/ws` → 3001) | 开发环境同域，避免 CORS |
| Tailwind | v4 + @tailwindcss/vite | 零配置 CSS 导入 |
| Agent 权限 | `--permission-mode bypassPermissions` | 临时方案，后续需实现完整权限审批流 |

---

## 交付物

### 数据库层
- `db/schema.ts` — 12 张表的 Drizzle ORM schema
- `db/index.ts` — sql.js 连接管理，文件持久化
- `db/migrate.ts` — `CREATE TABLE IF NOT EXISTS` 幂等迁移
- `db/seed.ts` — 默认 Agent 种子数据（Claude Code、Codex，含头像路径）

### 服务层
- `services/chat.service.ts` — 会话 CRUD、重命名、置顶、删除（级联清理）、消息 CRUD、Pin、搜索、归档、Agent-Map 批量查询、单条消息删除
- `services/agent-runtime.service.ts` — Agent 适配器生命周期、Run 管理、流式事件桥接、singleton 共享 `AbortController`、abort 后 DB 内容覆盖

### API 层
- `routes/conversations.ts` — 会话列表/创建/删除/重命名/置顶/归档，消息列表/发送/Pin/删除，Agent 映射查询，abort 后跳过 delta 追加
- `routes/agents.ts` — Agent 列表/创建/更新
- `routes/runs.ts` — Run 状态查询/停止

### WebSocket 层
- `ws/gateway.ts` — 基于 `ws` 的房间管理、事件广播，AgentEvent → WS 事件转换

### Web 前端
- `App.tsx` — 左右分栏布局，全局状态管理（会话列表、Agent 映射、刷新控制）
- `components/chat/ConversationList.tsx` — 会话列表（含 Agent 头像/徽章）、搜索、新建会话（Agent 选择器）、上下文菜单（置顶/重命名/删除）、置顶排序、行内重命名编辑
- `components/chat/ChatArea.tsx` — 消息列表、流式实时显示（思考中动画 + 回答完毕/对话被打断标识）、WebSocket 实时更新、消息操作菜单（📋复制/🗑️删除）、停止输出按钮
- `components/chat/MessageInput.tsx` — 文本输入、Enter 发送、自动增高、停止输出按钮（运行时替换发送按钮）
- `hooks/useWebSocket.ts` — WebSocket 连接管理，自动加入/离开会话房间
- `lib/api.ts` — REST API 客户端封装（完整覆盖所有端点，含 deleteMessage/stopRun）

### 共享类型
- `types/db.ts` — 所有 DB 行类型
- `types/ws.ts` — 客户端/服务端 WebSocket 事件类型
- `types/agent-event.ts` — 统一 AgentEvent 类型（含 `permission_request`）

### 静态资源
- `public/agents/claude-code.png` — Claude Code 头像
- `public/agents/codex.png` — Codex 头像

---

## Bug 修复记录

| Bug | 根因 | 修复 |
|---|---|---|
| 用户消息重复显示 | 前端 `handleSend` 添加 + 服务端 WS 广播导致双重添加 | 服务端移除用户消息的 WS 广播 |
| Agent 流式回复不显示 | 客户端未创建 agent 占位消息，`message:delta` 匹配不到消息 | 客户端在 API 返回后立即创建 agent 占位消息 |
| "Streaming..." 提示不消失 | 服务端未映射 `message:completed` 事件 | 服务端在 run 结束时广播 `message:completed` |
| 停止输出无效果 | `conversations.ts` 和 `runs.ts` 各自创建独立 `AgentRuntimeService`，abort controller 互不可见 | 改为 singleton `getAgentRuntimeService()` |
| 停止后 DB 仍有部分输出 | abort 后缓冲的 text_delta 仍被追加到 DB | `onEvent` 追加前检查 `isRunAborted()`；abort 后 `setContent("")` 覆盖 |
| 停止后 `❌️对话被打断` 一闪消失 | `message:completed` WS 事件无条件覆盖 status 为 `"sent"` | 仅当 `"streaming"` 时才转为 `"sent"` |
| Agent 无法读取文件 | ClaudeCodeAdapter 未设权限模式，子进程等待 stdin | 添加 `--permission-mode bypassPermissions` |

---

## UX 特性

| 特性 | 说明 |
|---|---|
| 前端中文化 | 所有按钮、标签、提示、状态文本全面中文化 |
| Agent 选择 | 新建对话时从下拉菜单选择 Agent，对话列表显示对应头像 |
| 流式动画 | Agent 回复时显示 "思考中🤔" + 动态点（1→2→3 循环） |
| 完成/打断提示 | 正常结束显示 "回答完毕✅️"，打断显示 "❌️对话被打断" |
| 在线标识 | 对话标题旁绿色圆点常驻显示 |
| 停止输出 | 🛑停止输出按钮（输入框旁），点击后立即终止 Agent 进程，清空内容，DB 同步 |
| 消息操作菜单 | 每条消息 hover 显示 `···` → 📋复制 / 🗑️删除（含后端 API + DB 删除） |
| 操作按钮位置 | 发送消息左下角，接收消息右下角 |
| 置顶 | 📌 置顶/取消置顶，已置顶对话排在最前并带标识 |
| 重命名 | 行内编辑，Enter 保存 / Escape 取消 |
| 删除对话 | 级联删除对话及全部关联数据，页面内确认弹窗 |
| 页面内弹窗 | 新建对话和删除确认均使用自定义 Modal，替代浏览器原生弹窗 |

---

## 验证结果

| 测试项 | 结果 |
|---|---|
| TypeScript 编译（shared / server / web） | 通过 |
| 服务启动 + 健康检查 | 通过 |
| 创建会话（含 Agent 选择） | 通过 |
| 发送消息 → Agent 流式回复 | 通过 |
| 流式动画 + 完成提示 | 通过 |
| 停止输出 → 立即打断 + DB 持久化 | 通过 |
| 消息持久化（刷新恢复） | 通过 |
| 消息复制 / 删除 | 通过 |
| 重命名 / 置顶 / 删除会话 | 通过 |
| Agent 头像显示 | 通过 |

## Phase 1 验收对照

| 验收项 | 状态 |
|---|---|
| Hono + WS + SQLite + Drizzle | 完成 |
| conversations/messages/runs/tool_invocations 表 | 完成 |
| ChatArea + ConversationList + MessageInput | 完成 |
| 1v1 调用真实平台 Agent | 完成 |
| 消息持久化，刷新后可恢复 | 完成 |
| 对话搜索和归档 | 完成 |
| 引用回复 `reply_to_id` | 完成 |
| 消息级 Pin | 完成 |
| file_changes + artifact 表 | 完成 |
| Agent 选择（新建时指定 Agent） | 完成 |
| 对话置顶 | 完成 |
| 对话重命名 | 完成 |
| 对话删除（级联） | 完成 |
| 页面内交互弹窗 | 完成 |
| 前端中文化 | 完成 |
| 停止输出（打断 Agent） | 完成 |
| 消息复制 / 删除 | 完成 |
| Agent 文件读取权限 | 完成（临时 bypassPermissions） |
