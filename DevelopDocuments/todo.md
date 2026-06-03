# AgentHub 待办事项

**更新日期：** 2026-06-02

---

## ⚠️ 当前已知问题

### 🟡 群聊多 Agent 文件变更重复播报

Agent 回复完毕后，对话流中的 **文件变更（FileChangeList）提示可正常显示**（✅ 已修复）。

当前 BUG：**群聊模式下，同一文件的同一操作出现重复播报**。

- **触发条件**：≥2 个 Agent 均执行了文件操作
- **不受影响**：单聊模式、群聊中只有 1 个 Agent 执行文件操作
- **可能原因**：多个 Agent 各自触发 `file_change` 事件 + `diffSnapshots` 重复写入，或群聊路径下 FileChange 去重逻辑缺失
- **相关文件**：`agent-runtime.service.ts`、`orchestrator.service.ts`、`workspace.service.ts`

### 🟢 多 Agent 编排任务 ID 冲突（已修复）

- Planner 生成固定 ID（task-1/task-2）导致二次运行 UNIQUE constraint 失败
- **已修复**：UUID 映射（`orchestrator.service.ts`）

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

- [x] 短期记忆（当前对话上下文）— 已修复 (2026-06-02)
- [ ] 记忆存储后端 — 设计记忆的持久化方案（DB 表 / 向量化 + 检索）（远期规划）
- [ ] 记忆注入机制 — 每次对话启动时自动载入相关记忆到 system prompt 或 context（远期规划）
- [ ] 记忆更新策略 — 何时写入新记忆、如何合并/淘汰旧记忆（远期规划）
- [ ] 前端记忆管理 UI — 查看/编辑/删除 Agent 记忆（远期规划）

---

### 4.2 对话中 Diff 展示完善

- [x] Agent 回复未携带 Diff — DiffBlock 组件已就绪，可解析 Agent 输出的 `` ```diff `` 块并彩色渲染
- [x] DiffCard 在对话流中的定位 — MarkdownContent 中 `` ```diff `` 块使用 DiffBlock 内联渲染
- [x] 消息内 Diff 语法高亮 — DiffBlock 组件：+ 绿 / - 红 / @@ 蓝 / 上下文灰
- [x] Diff 与 FileChange 联动 — 点击 diff 文件路径自动打开 WorkspacePanel 变更 Tab 并高亮对应记录
- [x] 增量 Diff 渲染 — 超过 20 行的 diff 默认折叠，可展开/收起

### 当前行为
Agent 消息中的 `` ```diff `` 代码块使用 DiffBlock 组件渲染（彩色行、文件路径可点击定位）。WorkspacePanel 的 DiffCard 同样使用 DiffBlock 展示真实 unified diff（服务端通过 `diff` 库生成，快照文件副本存储于 `data/snapshots/`）。点击 diff 文件路径自动切换到 WorkspacePanel 变更 Tab 并高亮对应记录。

---

### 4.3 WorkspacePanel 集成完善

- [x] 文件树数据为空 — 服务端 `GET /api/workspaces/:id/files` + 前端 `listFiles` + `workspace.store` 已接入
- [x] 快照列表为空 — 快照通过 `workspace.store.load()` 加载并传入 WorkspacePanel
- [x] workspace.store 未接入 App — `useWorkspaceStore` 已在 App.tsx 中使用，作为单一数据源
- [x] 文件树构建 — `WorkspaceService.buildFileTree()` 递归扫描目录生成 `FileNode[]`
- [x] 文件树选中状态 — `onFileSelect` 回调已提供
- [x] 面板可见性控制 — `ui.store` + 折叠/展开按钮已实现
- [x] 面板宽度拖拽调整 — 左边缘拖拽手柄，240px~600px
- [x] 快照回滚 — `rollbackToSnapshot()` 恢复工作目录到快照时状态
- [x] 新增文件内容查看 — "create" 类型变更展开后显示文件实际内容（二进制检测）
- [x] 工作目录手动更改 — 文本输入方式指定新路径
- [x] 新建对话指定工作目录 — 创建对话时可选填写，留空使用默认目录
- [x] Agent 工作目录修复 — `workingDir` 使用 workspace rootPath 而非 `process.cwd()`
- [x] WS 事件驱动的 workspace 刷新 — `run:started`/`run:completed` 触发重新加载
- [x] 事件重排修复 — `run_completed` 延迟到 `diffSnapshots` 之后广播，消除竞态条件
- [x] 对话隔离 — `activeConversationId` 追踪，切换对话时清空旧 `fileChanges`
- [x] Store upsert — `updateFileChange` 支持新增条目（不仅是更新已有条目）
- [x] **文件更改实时提示 — ✅ 已验证通过** — 事件重排 + WS 广播修复后，Agent 完成后变更提示正常出现
- [ ] **🟡 群聊多 Agent 文件变更重复播报** — ≥2 个 Agent 执行文件操作时，同一文件的同一操作出现多条重复记录；单聊、群聊单 Agent 均无此问题
- [ ] 后端确保 manifest 数据正确生成 — workspace 的 manifest/snapshots 链路需端到端验证

### 当前行为
WorkspacePanel 渲染在右侧（可拖拽调整宽度），文件 Tab 显示工作区目录树（带展开/折叠），快照 Tab 显示快照时间线（支持回滚），变更 Tab 展示 file_changes 数据（DiffBlock 彩色渲染、新增文件可直接查看内容）。面板可通过 ✕ 按钮关闭、折叠按钮展开。默认工作目录为 `Test/`，新建对话时可指定自定义目录。`workspace.store` 作为文件树/快照/变更的唯一数据源。Agent 在 workspace 目录下运行，修改的文件正确反映在面板中。**文件变更提示已可正常显示；群聊多 Agent 场景下存在重复播报待修复。**

---

### 4.4 Agent 回复富媒体内联展示

- [ ] 代码 Diff 内联 — Agent 回复中的 `` ```diff `` 代码块已在 MarkdownContent 中使用 DiffBlock 渲染（✅ 已实现），但尚未与 file_changes 实时数据链路打通
- [ ] 网页预览卡片 — Agent 生成的 HTML/网页产物应在对话流中以内联 iframe 或缩略图卡片形式预览
- [ ] 文件附件 — Agent 产出的文件（图片、PDF、代码文件等）应以附件卡片形式展示，支持下载和预览
- [ ] 产物卡片统一组件 — 设计统一的 `ArtifactCard` 内联渲染组件，替代纯文本 Markdown 链接
- [ ] 用户直接操作 — 用户应能在聊天流中直接预览网页、下载文件、应用 diff，无需切换到右侧面板

### 当前行为
Agent 回复中的 Markdown 链接、图片等以标准 Markdown 组件渲染。`` ```diff `` 代码块已通过 DiffBlock 彩色渲染。但网页预览（iframe）、文件附件卡片、产物卡片等富媒体内联展示尚未实现，用户需切换到 WorkspacePanel 查看变更。
