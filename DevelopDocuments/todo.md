# AgentHub 待办事项

**更新日期：** 2026-06-05

---

## Phase 2 待完善

- [x] Codex CLI 安装与端到端验证 — 已跳过（需要 OpenAI API Key，与 DeepSeek 环境不匹配，自动降级机制已就位）

---

## Bug 修复

- [x] **自建 Agent 数据丢失** — 已修复：`App.tsx` 初始化时调用 `agentStore.load()`，确保刷新后 Agent 列表正确加载
- [x] **Agent 禁用/启用过滤不生效** — 已修复：`ConversationList.tsx` 新建对话调用 `listAgents(true)` 只加载已启用 Agent
- [x] **文件修改后预览不刷新** — 已修复：ChatArea.tsx 移除跨 run artifact 去重
- [x] **Planner 后续消息重复出原始计划** — 已修复：orchestrator 检测 prior runs + 注入 follow-up 提示
- [x] **PPT 文件变更白名单过滤** — 已修复：`shouldSkipFile` PPT 模式
- [x] **能力标签 emoji fallback** — 已修复：前端 `startsWithEmoji()` 检测
- [x] **ESM Hoisting API Key** — 已修复：Planner + AgentBuilder 构造时从 `process.env` 动态读取

---

> **Phase 6 全部完成，详见：** `DevelopDocuments/milestones/phase6/phase6-completion.md`
