# AgentHub 待办事项

**更新日期：** 2026-06-05

---

## Phase 2 待完善

- [x] Codex CLI 安装与端到端验证 — **已跳过**（需要 OpenAI API Key，与 DeepSeek 环境不匹配，自动降级机制已就位）

---

## Bug 修复

- [x] **PPT 修改后预览缺失** — 修复：artifact:created WS 处理器跨 run 去重改为替换模式，修改后的 PPT 新 artifact 替换旧 run 中的同名 artifact
- [x] **自建 Agent 数据丢失** — 修复：App.tsx 初始化时调用 agentStore.load()，确保刷新后 Agent 列表正确加载
- [x] **Agent 禁用/启用不生效** — 修复：新建对话调用 listAgents(true) 只加载已启用 Agent；Agent 管理面板加载全部
- [x] **Agent 创建缺平台选择** — 修复：AgentCreationModal 添加平台下拉框；去掉无用的 LLM 解析步骤，简化为纯手动表单

---
