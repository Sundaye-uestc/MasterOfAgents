# AgentHub 待办事项

**更新日期：** 2026-06-02（整理完成项至 phase4-completion，保留待办和已知 BUG）

---

## ⚠️ 当前已知 BUG

| # | BUG | 状态 | 描述 |
|---|-----|------|------|
| 1 | **文件变更提示不出现** | ❌ 未修复 | Agent 回复完毕后 FileChangeList 不显示文件变更；刷新页面后变更记录正常出现。WS `file:changed` 事件 + HTTP `load()` 双通道均无法实时送达前端 |
| 2 | **文件变更重复提示** | ❌ 未修复 | 同一文件的同一次操作（如 create: hello.py）出现多条重复记录。可能原因：`file_change` 事件在 stream 中触发 + `diffSnapshots` 又写入一份，导致 DB 中存在重复行 |

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

> ✅ 全部完成，详见 `milestones/phase4/phase4-completion.md`

### 当前行为
Agent 消息中的 `` ```diff `` 代码块使用 DiffBlock 组件渲染（彩色行、文件路径可点击定位）。WorkspacePanel 的 DiffCard 同样使用 DiffBlock 展示真实 unified diff。点击 diff 文件路径自动切换到 WorkspacePanel 变更 Tab 并高亮对应记录。

---

### 4.4 Agent 回复富媒体内联展示

- [ ] 代码 Diff 内联 — Agent 回复中的 `` ```diff `` 代码块已在 MarkdownContent 中使用 DiffBlock 渲染（✅ 已实现），但尚未与 file_changes 实时数据链路打通
- [ ] 网页预览卡片 — Agent 生成的 HTML/网页产物应在对话流中以内联 iframe 或缩略图卡片形式预览
- [ ] 文件附件 — Agent 产出的文件（图片、PDF、代码文件等）应以附件卡片形式展示，支持下载和预览
- [ ] 产物卡片统一组件 — 设计统一的 `ArtifactCard` 内联渲染组件，替代纯文本 Markdown 链接
- [ ] 用户直接操作 — 用户应能在聊天流中直接预览网页、下载文件、应用 diff，无需切换到右侧面板

### 当前行为
Agent 回复中的 Markdown 链接、图片等以标准 Markdown 组件渲染。`` ```diff `` 代码块已通过 DiffBlock 彩色渲染。但网页预览（iframe）、文件附件卡片、产物卡片等富媒体内联展示尚未实现，用户需切换到 WorkspacePanel 查看变更。

---

### 4.3 WorkspacePanel 集成完善

> ✅ 基础功能全部完成，详见 `milestones/phase4/phase4-completion.md`

**待修复：**

- [ ] 实时同步不完整 — WS `file:changed` 已接入 store，但 Agent 回复完毕后 FileChangeList 仍为空白（需刷新页面才出现），**BUG #1**
- [ ] 文件变更去重 — 同一文件操作出现多条重复 FileChange 记录，需排查 `file_change` 事件 + `diffSnapshots` 双写入问题，**BUG #2**

### 当前行为
WorkspacePanel 渲染在右侧（可拖拽调整宽度），文件 Tab 显示工作区目录树（带展开/折叠），快照 Tab 显示快照时间线（支持回滚），变更 Tab 展示 file_changes 数据（DiffBlock 彩色渲染、新增文件可直接查看内容）。面板可通过 ✕ 按钮关闭、折叠按钮展开。默认工作目录为 `Test/`，新建对话时可指定自定义目录。`workspace.store` 作为文件树/快照/变更的唯一数据源。Agent 在 workspace 目录下运行，修改的文件正确反映在面板中。

**已知问题（2026-06-02）：** FileChangeList 在 Agent 回复完毕后不显示变更（需刷新），且同一文件操作出现重复记录。详见顶部 "⚠️ 当前已知 BUG"。
