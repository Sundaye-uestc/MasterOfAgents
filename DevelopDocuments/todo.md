# AgentHub 待办事项

**更新日期：** 2026-06-03

---

## Phase 2 待完善

- [ ] Codex CLI 安装与端到端验证（当前 `spawn codex ENOENT`，运行时自动降级为 ClaudeCodeAdapter；代码已完成）

### 当前风险

| 风险 | 状态 | 应对 |
|---|---|---|
| Codex CLI 未跑通 | **代码已完成** | 安装 `codex` CLI + 配置 API Key 后即可启用 |
| 多 Agent 文件写入冲突 | 已应对 | 写入范围检测、串行化 |

---

## Phase 4

### 4.1 Agent 记忆能力

已完成并写入 [phase4-completion.md](milestones/phase4/phase4-completion.md)。pinned 消息优先注入（最多 5 条）+ 4000 字符上下文窗口 + `[用户]`/`[AI助手]` 角色标记，已通过测试验证。

---

### 4.2 对话中 Diff 展示完善

已完成并写入 [phase4-completion.md](milestones/phase4/phase4-completion.md)。

---

### 4.3 WorkspacePanel 集成完善

- [ ] 后端确保 manifest 数据正确生成 — workspace 的 manifest/snapshots 链路需端到端验证

已完成项见 [phase4-completion.md](milestones/phase4/phase4-completion.md)。

---

### 4.4 Agent 回复富媒体内联展示

- [ ] Diff ↔ file_changes 数据链路打通 — `` ```diff `` 代码块与 file_changes 实时数据联动
- [ ] 网页预览卡片 — Agent 生成的 HTML/网页产物应在对话流中以内联 iframe 或缩略图卡片形式预览
- [ ] 文件附件 — Agent 产出的文件（图片、PDF、代码文件等）应以附件卡片形式展示，支持下载和预览
- [ ] 产物卡片统一组件 — 设计统一的 `ArtifactCard` 内联渲染组件，替代纯文本 Markdown 链接
- [ ] 用户直接操作 — 用户应能在聊天流中直接预览网页、下载文件、应用 diff，无需切换到右侧面板
