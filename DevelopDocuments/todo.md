# AgentHub 待办事项

**更新日期：** 2026-06-04

---

## Phase 2 待完善

- [ ] Codex CLI 安装与端到端验证（运行时自动降级为 ClaudeCodeAdapter）

---

## 4.5 用户自建 Agent

- [ ] 对话式创建 Agent — 用户通过自然语言描述需求，系统自动生成 Agent 配置（名称、描述、System Prompt）
- [ ] 自定义 System Prompt — 用户可编辑 Agent 的系统提示词，定义其行为与专业领域
- [ ] 工具集配置 — 用户可为自建 Agent 选择/配置可用工具集（文件读写、Shell、网络等）
- [ ] Agent 管理界面 — 列表展示自建 Agent，支持编辑、启用/禁用、删除

---

## 当前风险

| 风险 | 状态 | 应对 |
|---|---|---|
| Codex CLI 未跑通 | 代码已完成 | 安装 CLI + 配置 Key |
| 多 Agent 文件写入冲突 | 已应对 | 写入范围检测、串行化 |

---
