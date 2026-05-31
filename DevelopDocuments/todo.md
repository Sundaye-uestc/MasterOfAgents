# AgentHub 待办事项

**更新日期：** 2026-05-31（Phase 3 遗留完成 + Phase 4.3 部分完成）

---

## Phase 2 待完善

- [ ] Codex CLI 安装与端到端验证（当前 `spawn codex ENOENT`，运行时自动降级为 ClaudeCodeAdapter；代码已完成）

### 当前风险

| 风险 | 状态 | 应对 |
|---|---|---|
| Codex CLI 未跑通 | **代码已完成** | 安装 `codex` CLI + 配置 API Key 后即可启用 |
| 多 Agent 文件写入冲突 | 已应对 | 写入范围检测、串行化 |

---

## Phase 3 遗留项

- [x] WS 连接注册表（`connection-registry.ts`）— 管理多连接、断线清理
- [x] 乐观更新封装（`optimistic-updates.ts`）— 统一的乐观写入 + 失败回滚

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

### 4.3 WorkspacePanel 集成完善

- [x] 文件树数据为空 — 服务端 `GET /api/workspaces/:id/files` + 前端 `listFiles` + `workspace.store` 已接入
- [x] 快照列表为空 — 快照通过 `workspace.store.load()` 加载并传入 WorkspacePanel
- [x] workspace.store 未接入 App — `useWorkspaceStore` 已在 App.tsx 中使用，作为单一数据源
- [x] 文件树构建 — `WorkspaceService.buildFileTree()` 递归扫描目录生成 `FileNode[]`
- [x] 文件树选中状态 — `onFileSelect` 回调已提供，等待编辑器/预览组件连接
- [x] 面板可见性控制 — `ui.store` + 折叠/展开按钮已实现
- [ ] 实时同步不完整 — WS `file:changed` 已接入 store，但多连接场景下的时序问题待验证
- [ ] 后端确保 manifest 数据正确生成 — workspace 的 manifest/snapshots 链路需端到端验证

### 当前行为
WorkspacePanel 已渲染在界面右侧（320px），文件 Tab 显示工作区目录树（带展开/折叠），快照 Tab 显示快照时间线，变更 Tab 展示 file_changes 数据。面板可通过折叠按钮切换显示/隐藏。`workspace.store` 作为文件树/快照/变更的唯一数据源，App.tsx 和 ChatArea.tsx 共享同一 store。
