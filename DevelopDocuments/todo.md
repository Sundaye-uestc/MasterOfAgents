# AgentHub 待办事项

**更新日期：** 2026-05-29（Phase 3 全部完成）

---

## Phase 2 待完善

- [ ] Codex CLI 安装与端到端验证（当前 `spawn codex ENOENT`，运行时自动降级为 ClaudeCodeAdapter；代码已完成）

### 当前风险

| 风险 | 状态 | 应对 |
|---|---|---|
| Codex CLI 未跑通 | **代码已完成** | 安装 `codex` CLI + 配置 API Key 后即可启用 |
| 多 Agent 文件写入冲突 | 已应对 | 写入范围检测、串行化 |

---

## Phase 3：产物与部署（Artifacts & Deployment）

> 参考设计：`AgentHub-web端系统设计.md` §16、`AgentHub-web端模块设计.md` §2.10–2.12 & §3.3–3.5

### 3.1 File Changes 闭环

- [x] before/after snapshot 自动化 — run 启动前 `createSnapshot(before)`，完成后 `createSnapshot(after)`
- [x] `WorkspaceService.diffSnapshots()` — 比对 manifest 生成 `file_changes` 记录
- [x] DiffCard 组件 — 展示代码差异（参考 AgentVerse markdown/diff 组件）
- [x] `POST /api/file-changes/:id/apply` — 应用文件变更
- [x] `POST /api/file-changes/:id/revert` — 回滚文件变更
- [x] FileChangeList 组件 — 变更列表 + apply/revert 操作按钮

### 3.2 Artifact 系统（产物）

- [x] `ArtifactService` — 从 file_changes 或输出目录创建 artifact；提供预览 URL / 下载
- [x] `artifacts` 表 + Zod schema（已在设计中定义）
- [x] `routes/artifacts.ts` — `GET /api/artifacts/:id`、`POST /api/artifacts/:id/deploy`
- [x] ArtifactCard 组件 — 产物卡片基类
- [x] WebPreviewCard 组件 — iframe 网页预览（`preview_url` → `<iframe>`）
- [x] DownloadCard 组件 — 下载卡片（文件大小、类型、下载按钮）

### 3.3 部署（Deploy）

- [x] `DeployService` — 本地静态预览、workspace zip 打包下载、部署状态推送
- [x] `deployments` 表 + Zod schema（已在设计中定义）
- [x] `routes/deployments.ts` — 部署相关 REST 端点
- [x] DeployStatusCard 组件 — 部署状态卡片（pending → building → deployed/failed）
- [x] 本地静态预览（`local-static` 模式 — 启动本地 server 提供 iframe 预览）
- [x] workspace zip 下载（打包 workspace 根目录 → 下载链接）

### 3.4 安全服务

- [x] `SecurityService` — secrets 加密存储、命令风险分级、审计日志
- [x] `secrets` 表 + `routes/secrets.ts` — CRUD（已在设计中定义）
- [x] `audit_logs` 落库 — 记录 stderr、高风险命令、权限决策
- [x] secret 不入消息、日志、tool result（在设计约束中已定义）

### 3.5 Workspace 前端面板

- [x] FileTree 组件 — 工作区文件树（VSCode 风格）
- [x] SnapshotList 组件 — 快照时间线列表
- [x] WorkspacePanel 组件 — 右侧/底部面板容器，整合 FileTree + SnapshotList + FileChangeList

### 3.6 前端架构升级

- [x] Zustand stores 迁移（当前用本地 `useState`）
  - `conversation.store` — 会话列表、搜索、归档筛选
  - `message.store` — 消息缓存、流式更新、replyTarget
  - `agent.store` — Agent 列表、可用性、能力过滤
  - `run.store` — active runs、tasks、tool invocations
  - `artifact.store` — artifacts、deployments 状态
  - `workspace.store` — files、snapshots、fileChanges
  - `ui.store` — panels、dialogs、selection
- [x] Zod schemas 校验 — REST body + WS event（`packages/shared/src/schemas/`）
- [ ] WS 连接注册表（`connection-registry.ts`）— 管理多连接、断线清理
- [ ] 乐观更新封装（`optimistic-updates.ts`）— 统一的乐观写入 + 失败回滚
- [x] Event dispatcher（`event-dispatcher.ts`）— ServerEvent 自动分发到对应 store

### 3.7 组件拆分与重构

- [x] `MessageList.tsx` — 从 ChatArea 中拆出消息列表渲染
- [x] `MessageBubble.tsx` — 独立的消息气泡组件（含 Markdown、回复指示器、操作菜单）
- [x] `ConversationSearchBar.tsx` — 独立的搜索栏组件（当前搜索逻辑内联在 ConversationList 中）

### 3.8 Shared 类型扩展

- [x] `types/artifact.ts` — Artifact、ArtifactType、DeployStatus
- [x] `types/workspace.ts` — WorkspaceRef、Snapshot、FileChange、Manifest
- [x] `schemas/artifact.schema.ts`、`schemas/workspace.schema.ts` — Zod 校验
- [x] `constants.ts` — 事件名、状态枚举、sandbox 模式常量

---

## Phase 4（规划中）

### 4.1 Agent 记忆能力

- [ ] 短期记忆 — 当前对话上下文窗口内保留关键信息（已实现）
- [ ] 长期记忆 — Agent 在跨对话/跨会话场景下无法记住用户偏好、历史决策、重复指令
- [ ] 记忆存储后端 — 设计记忆的持久化方案（DB 表 / 向量化 + 检索）
- [ ] 记忆注入机制 — 每次对话启动时自动载入相关记忆到 system prompt 或 context
- [ ] 记忆更新策略 — 何时写入新记忆、如何合并/淘汰旧记忆
- [ ] 前端记忆管理 UI — 查看/编辑/删除 Agent 记忆

### 当前行为
Agent 每次新对话都是"冷启动"，没有跨对话记忆。单次对话中通过消息历史维持上下文，但对话结束后信息完全丢失。

---

### 4.2 对话中 Diff 展示完善

- [ ] Agent 回复未携带 Diff — 确认 Agent（Claude Code / Codex）是否在 `text_delta` 中输出 diff 内容，以及前端是否正确解析和渲染
- [ ] DiffCard 在对话流中的定位 — FileChangeList 已渲染 DiffCard，但 Agent 消息中的代码差异可能应当内联展示而非仅出现在右侧面板
- [ ] 消息内 Diff 语法高亮 — 对话气泡中 Markdown 渲染的 ` ```diff ` 代码块应使用 DiffCard 组件替代纯文本
- [ ] Diff 与 FileChange 联动 — 点击消息中的 diff 应高亮右侧面板中对应的 file_change 记录
- [ ] 增量 Diff 渲染 — 长 diff 默认折叠，可展开查看完整上下文

### 当前行为
Agent 可能通过 markdown 代码块输出文件变更，但前端仅作为普通文本渲染，没有利用 file_changes 数据链路进行结构化展示。DiffCard 组件已存在但仅在 WorkspacePanel 中展示。

---

## 实现顺序建议

1. **3.8 Shared 类型** — 先行定义 artifact/workspace 类型和 schema
2. **3.1 File Changes** — before/after snapshot + diff → 基础数据链路
3. **3.2 Artifact** — ArtifactService + ArtifactCard → 从 file_changes 到可见卡片
4. **3.3 Deploy** — DeployService + DeployStatusCard → 预览和下载
5. **3.4 Security** — secrets + audit_logs 落库
6. **3.5 Workspace 面板** — FileTree + WorkspacePanel 前端 UI
7. **3.6 前端架构升级** — Zustand + Zod + 事件分发（贯穿前几项，最后统一）
8. **3.7 组件重构** — 拆分 MessageList/MessageBubble 等
