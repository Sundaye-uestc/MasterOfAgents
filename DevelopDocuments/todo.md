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

### 4.3 WorkspacePanel 集成完善 ✅

端到端验证已完成（2026-06-03）。快照创建/列出/回滚/删除、文件树、文件内容 API 全部通过，修复 2 个 bug。详见 [phase4-completion.md](milestones/phase4/phase4-completion.md)。

- [x] 后端确保 manifest 数据正确生成 — workspace 的 manifest/snapshots 链路需端到端验证

---

### 4.4 Agent 回复富媒体内联展示 ✅

已完成并写入 [phase4-completion.md](milestones/phase4/phase4-completion.md)。

- [x] Diff ↔ file_changes 数据链路打通 — InlineDiffCard 内联展示 + Apply/Revert 操作，FileChangeList 从对话框顶部移至消息下方
- [x] 网页预览卡片 — WebPreviewCard 内联 iframe，支持收起/展开 + 新窗口打开
- [x] 文件附件 — 图片内联预览 + DownloadCard 下载卡片
- [x] 产物卡片统一组件 — InlineArtifactCard 根据 MIME 类型统一分发渲染（webpage / image / text → TextPreviewCard / download）
- [x] 用户直接操作 — apply/revert diff、预览网页、下载文件均在聊天流中完成（2026-06-03 修复：delete/changeType 统一显示 Apply+Revert 按钮）
- [x] 服务端 artifact 自动创建 pipeline + artifact:created WS 广播（2026-06-03 扩展：~40 种代码扩展全覆盖 + text/plain 兜底）
- [x] 文本文件内联预览 — TextPreviewCard fetch 内容直显，大文件折叠展开（2026-06-03）

---

### 4.5 用户自建 Agent

- [ ] 对话式创建 Agent — 用户通过自然语言描述需求，系统自动生成 Agent 配置（名称、描述、System Prompt）
- [ ] 自定义 System Prompt — 用户可编辑 Agent 的系统提示词，定义其行为与专业领域
- [ ] 工具集配置 — 用户可为自建 Agent 选择/配置可用工具集（文件读写、Shell、网络等）
- [ ] Agent 管理界面 — 列表展示自建 Agent，支持编辑、启用/禁用、删除
