# AgentHub 待办事项

**更新日期：** 2026-06-04

---

## Phase 2 待完善

- [ ] Codex CLI 安装与端到端验证（运行时自动降级为 ClaudeCodeAdapter）

---

## Bug 修复

- [ ] **PPT 修改后预览缺失**：修改 PPT（如"加一页"）时，Agent 修改完毕后没有再次展示 PPT 预览。需排查 .pptx 文件变更后 HTML 预览的生成/展示链路
- [ ] **自建 Agent 数据丢失**：自建 Agent 的对话框不稳定，刷新页面后该 Agent 的对话历史消失，Agent 管理中也找不到该 Agent。需排查 DB 持久化 / 前端加载逻辑

---

