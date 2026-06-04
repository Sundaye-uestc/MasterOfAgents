# AgentHub 待办事项

**更新日期：** 2026-06-04

---

## Phase 2 待完善

- [ ] Codex CLI 安装与端到端验证（运行时自动降级为 ClaudeCodeAdapter）

---

## 4.5 用户Agent 管理

### 4.5.1 对话式创建 Agent

**入口**：侧边栏新增「新建 Agent」按钮。

**页面**：弹窗（Modal），出现在当前页面之上。纯对话式，用户输入自然语言描述想要的 Agent，LLM 解析并润色。弹窗关闭即清空，不保留历史消息。

**LLM 解析**：复用 Planner 同款 LLM（多厂商兼容），从用户模糊描述中提取结构化配置：
- name — Agent 名称
- platform — 推荐平台（claude-code / codex）
- systemPrompt — 润色后的 System Prompt（用户说"擅长做PPT" → LLM 润色为专业的系统提示词）
- capabilities — 匹配的工具集标签

**确认方式**：弹窗展示润色后的配置，用户可修改 name / systemPrompt / capabilities 后确认创建 → `POST /api/agents/from-draft`。

**后端任务：**
- [ ] `services/agent-builder.service.ts` — `parseCreationIntent(message)` 调用 LLM 提取 AgentConfigDraft；`polishText(input)` 润色模糊文字
- [ ] `routes/agents.ts` — 新增 `POST /api/agents/parse-intent` 端点，返回解析后的 draft 供前端预览
- [ ] `routes/agents.ts` — 增强 `POST /api/agents/from-draft`，支持 capabilities / avatar 字段

**前端任务：**
- [ ] `components/agent/AgentCreationModal.tsx` — 弹窗对话式创建，内含聊天区 + 确认预览（润色后的 name / systemPrompt / capabilities），关闭即清空

---

### 4.5.2 自定义 System Prompt

**入口**：Agent 头像旁的右键菜单 →「编辑」。

**方式**：弹窗分字段表单（名称、System Prompt、能力标签）。LLM 对模糊输入自动润色。

**生效**：修改后前端提示「✅ 修改完成，下次对话时生效」。

**后端任务：**
- [ ] `PATCH /api/agents/:id` — 增强，支持更新 capabilities、avatar
- [ ] `POST /api/agents/polish-prompt` — LLM 润色 System Prompt 端点

**前端任务：**
- [ ] `components/agent/AgentEditModal.tsx` — 分字段编辑弹窗（名称 / System Prompt / 能力标签），含「AI 润色」按钮
- [ ] 右键菜单 — Agent 列表项新增「编辑」选项

---

### 4.5.3 工具集配置

**工具集（10 个场景）：**

| 工具集 | 说明 |
|---|---|
| PPT 生成 | pptxgenjs + Gemini AI 幻灯片 |
| 文档撰写 | Markdown、技术文档、README |
| 数据分析 | 数据处理、可视化、报表 |
| 前端开发 | HTML/CSS/JS/React/Vue |
| 后端开发 | Node/Python/Go API 服务 |
| 代码调试 | 错误定位、日志分析、修复建议 |
| 文件管理 | 批量重命名、格式转换、搜索 |
| 网络搜索 | 信息检索、网页抓取 |
| 测试编写 | 单元测试、集成测试、覆盖率 |
| 安全审查 | 漏洞扫描、依赖检查 |

**选择方式**：LLM 根据用户对话自动匹配，无需用户手动勾选。

**生效方式**：工具集描述注入 Agent System Prompt。

**后端任务：**
- [ ] `shared/tool-sets.ts` — 定义 10 个工具集的 id / name / description / promptSnippet
- [ ] `services/agent-builder.service.ts` — `matchToolSets(userDescription)` 基于关键词 + LLM 匹配

---

### 4.5.4 Agent 管理界面

**位置**：侧边栏底部，与用户头像/「我」左右并排，竖线分割。

**布局：**
```
┌─────────────────────────────┐
│  👤 我  │ ⚙️ Agent 管理 >   │
└─────────────────────────────┘
```

点击「Agent 管理 >」展开管理面板。

**列表展示：** 名称、头像（默认平台图标）、能力标签、启用/禁用开关。

**操作项：**
- 启用/禁用 — 开关按钮，即时生效
- 编辑 — 头像 / 名称 / System Prompt（复用 4.5.2 编辑弹窗）
- 查看详情 — 弹出详情面板（完整配置只读展示）
- 删除 — 二次确认弹窗，级联清理关联数据

**后端任务：**
- [ ] `GET /api/agents` — 增强，默认过滤 `enabled = 1`，可选参数 `?includeDisabled=true` 返回全部
- [ ] `DELETE /api/agents/:id` — 新增删除端点，级联清理（待确认范围）
- [ ] `PATCH /api/agents/:id` — 增强，支持 avatar 字段更新
- [ ] `GET /api/agents/:id` — 已有，确认返回完整字段

**前端任务：**
- [ ] `components/agent/AgentManagePanel.tsx` — 侧边栏管理面板（列表 + 开关 + 删除 + 详情入口）
- [ ] `components/agent/AgentDetailModal.tsx` — 详情只读弹窗
- [ ] `components/agent/AgentDeleteConfirmModal.tsx` — 删除确认弹窗
- [ ] 侧边栏布局改造 — 用户区域 + 竖线分割 + Agent 管理入口

---

## 当前风险

| 风险 | 状态 | 应对 |
|---|---|---|
| Codex CLI 未跑通 | 代码已完成 | 安装 CLI + 配置 Key |
| 多 Agent 文件写入冲突 | 已应对 | 写入范围检测、串行化 |

---
