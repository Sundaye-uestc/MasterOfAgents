# Phase 6 开发完成文档

**完成日期：** 2026-06-05

---

## 概述

Phase 6 实现 4.5 用户 Agent 管理 + 群聊 Planner 修复与验证。

- **Agent 管理**：对话式弹窗创建自定义 Agent，LLM 解析自然语言 → 结构化配置，支持 System Prompt 编辑/AI 润色/工具集自动匹配，完整 CRUD 管理界面
- **Planner 修复**：ESM hoisting API Key 修复、Prompt 强化（中文输出/任务边界/能力匹配）、DAG 依赖调度验证、Follow-up 消息处理修复
- **其他修复**：PPT 文件变更白名单过滤、能力标签 emoji fallback、文件修改后预览不刷新

---

## 一、文件清单

### 1.1 新建文件

| 文件 | 说明 |
|---|---|
| `packages/shared/src/tool-sets.ts` | 10 个工具集定义 + 关键词匹配 + Prompt 注入/剥离 |
| `apps/server/src/services/agent-builder.service.ts` | LLM 解析创建意图 + System Prompt 润色 |
| `apps/web/src/components/agent/AgentCreationModal.tsx` | 两步弹窗：对话 → 预览确认 |
| `apps/web/src/components/agent/AgentEditModal.tsx` | 编辑名称/SystemPrompt/能力标签/工具集 + AI 润色 |
| `apps/web/src/components/agent/AgentDetailModal.tsx` | 只读详情 |
| `apps/web/src/components/agent/AgentDeleteConfirmModal.tsx` | 删除确认 |
| `apps/web/src/components/agent/AgentManagePanel.tsx` | 全屏管理面板 |
| `apps/web/public/agents/opencode.png` | OpenCode 头像（从根目录复制） |

### 1.2 修改文件

| 文件 | 说明 |
|---|---|
| `packages/shared/src/types/db.ts` | 新增 `ParsedAgentIntent`、`PolishPromptResponse` 类型 |
| `packages/shared/src/index.ts` | 导出 `tool-sets.ts` |
| `apps/server/src/routes/agents.ts` | 8 个端点：GET（`?enabled` 过滤）/ POST / POST from-draft / POST parse-intent / POST polish-prompt / GET :id / PATCH :id / DELETE :id |
| `apps/server/src/db/seed.ts` | 新增 `default-opencode` 内置 Agent |
| `apps/web/src/lib/api.ts` | `listAgents(enabledOnly?)` 过滤参数 |
| `apps/web/src/stores/agent.store.ts` | `update()` / `remove()` / `toggleEnabled()` |
| `apps/web/src/App.tsx` | 侧边栏 "Agent 管理 >" + `agentStore.load()` 初始化 |
| `apps/web/src/components/chat/CapabilityTags.tsx` | 集中管理 emoji + 中文标签映射，导出 `formatCapability()` |
| `apps/web/src/components/chat/AgentBadge.tsx` | 新增 `opencode` logo 映射 |
| `apps/web/src/components/chat/ConversationList.tsx` | 默认工作目录 `D:/Projects/MasterOfAgents/Test` + 启用过滤 |
| `apps/web/src/components/workspace/WorkspacePanel.tsx` | "文件"标签添加 SVG 刷新按钮（选中时显示） |
| `apps/server/src/services/planner.service.ts` | ESM hoisting 绕过 + Prompt 强化 + follow-up 规则 |
| `apps/server/src/services/orchestrator.service.ts` | Follow-up 检测 + DAG 调度 + Agent 名称映射 |
| `apps/web/src/components/chat/ChatArea.tsx` | 移除 InlineDiffCard + 移除跨 run artifact 去重 + 复用 `formatCapability` |
| `apps/web/src/components/agent/AgentEditModal.tsx` | 能力标签中文显示 |
| `apps/web/src/components/agent/AgentManagePanel.tsx` | 能力标签中文显示 |
| `apps/web/src/components/agent/AgentDetailModal.tsx` | 能力标签中文显示 |

---

## 二、4.5 用户 Agent 管理

| 子项 | 功能 |
|---|---|
| 4.5.1 | 对话式创建（弹窗 + LLM 解析自然语言 → 结构化配置） |
| 4.5.2 | 自定义 System Prompt 编辑 + AI 润色 |
| 4.5.3 | 工具集配置（10 个预定义集，LLM 自动匹配关键词） |
| 4.5.4 | Agent 管理界面（启用/禁用/编辑/删除/右键菜单） |

### 2.1 工具集（10 个）

| ID | 标签 | 图标 |
|---|---|---|
| `ppt` | PPT 生成 | 📊 |
| `docs` | 文档撰写 | 📝 |
| `data` | 数据分析 | 📈 |
| `frontend` | 前端开发 | 🎨 |
| `backend` | 后端开发 | ⚙️ |
| `debug` | 代码调试 | 🔧 |
| `file` | 文件管理 | 📁 |
| `search` | 网络搜索 | 🔍 |
| `test` | 测试编写 | 🧪 |
| `security` | 安全审查 | 🔒 |

`matchToolSetsByKeywords(description, capabilities)` 中英文关键词匹配 → `getToolSetPromptInjection()` 注入 System Prompt 末尾 → 更新时 `stripToolSetInjection()` 后重新追加。

---

## 三、群聊 Planner 修复

### 3.1 ESM Hoisting API Key 修复

`config.ts` 的 `resolveApiKey()` 在 ESM import 时（`dotenv.config()` 之前）执行，API key 为空 → Planner 始终 fallback 到 `degradedPlan`。**与 `AgentBuilderService` 完全相同的 bug。**

**修复**：`PlannerService` 构造函数绕过 `config.*` 静态值，直接从 `process.env` 运行时读取。新增 `resolveEnvApiKey()` 支持 8 个 provider。

### 3.2 Planner Prompt 强化

| 改动 | 说明 |
|---|---|
| Agent 能力附带 | `名称（ID）` → `名称（ID）— 擅长：xxx、xxx` |
| 无 @ 分配 | 必须分配给所有相关 Agent，不要集中给一个 |
| 能力匹配 | 根据能力描述分配给最擅长的 Agent |
| 输出中文化 | 首条规则：所有输出字段必须使用中文 |
| 任务边界 | description 只写该 Agent 自己的事，注明边界 |
| `preprocessMentions` | 无 @ 时注入提示要求自行分配 |
| degradedPlan | 只给第一个 Agent 单任务（之前：每人一份完整 prompt → 重复工作） |

### 3.3 Follow-up 消息处理

**问题**：用户对执行结果反馈 BUG 后，Planner 再次输出与第一次完全相同的任务分解。

**修复**：`startOrchestratedRun()` 查询对话是否有已完成的编排 run，有则在 prompt 头部注入 `[上下文：这是用户对上一轮任务执行结果的反馈...]` 提示；Planner prompt 加入对应识别规则。

### 3.4 DAG 依赖调度验证

**测试用例**："先用一个 Agent 写 data.json，再用另一个 Agent 写 HTML 读取并展示成绩表格"

| 验证项 | 结果 |
|---|---|
| Planner 分解 2 任务 + 依赖关系（task-2 依赖 task-1） | ✅ |
| 任务按 DAG 顺序执行（task-1 完成 → task-2 启动） | ✅ |
| 文件传递正常 | ✅ |
| Follow-up BUG 修复（只出 1 个修复任务） | ✅ |
| Planner 输出全中文 | ✅ |

---

## 四、文件修改后预览刷新修复

**问题**：同一文件多轮修改时，预览只在第一次出现。根因：`ChatArea.tsx` 三处跨 run 文件名去重逻辑（`seenNames` Set + `otherRunId` 循环）阻止了后续 run 中同文件名的 artifact 展示。

**修复**：移除跨 run 去重，仅保留 run 内 ID 去重。PPT 白名单过滤（`shouldSkipFile`）在服务端，不受影响。

---

## 五、关键架构决策

| 决策 | 说明 |
|---|---|
| Agent 创建用弹窗而非独立路由 | 用户明确要求，Modal overlay 在当前页之上 |
| ESM hoisting 绕过 | 构造时从 `process.env` 动态读取，不依赖 `config.ts` 静态值 |
| 工具集注入 System Prompt | 末尾追加 `【工具集配置】` 段落，更新时 strip + re-append |
| 能力标签中文化 + emoji | LLM prompt 约束输出，前端检测 emoji 前缀自动适配 |
| Drizzle 条件查询 | SQLite 不支持链式 `.where()` 类型推断，用独立 `if` 分支 |
| Follow-up 检测 | 查询 prior completed/failed runs → 注入上下文提示 |
| 预览跨 run 去重移除 | writeScope 已在编排层面阻止并发写冲突，前端无需再按文件名去重 |

---

## 六、验证结果

| 验证项 | 状态 |
|---|---|
| `POST /api/agents/parse-intent` → 结构化 JSON | ✅ |
| `POST /api/agents/polish-prompt` → 优化后 SystemPrompt | ✅ |
| `POST /api/agents/from-draft` — toolSetIds 注入 configJson | ✅ |
| `DELETE /api/agents/{custom-id}` → 200；内置 → 400 | ✅ |
| `GET /api/agents?enabled=true` 过滤 | ✅ |
| 创建弹窗 → 列表出现 → AgentPicker 可选 | ✅ |
| 编辑即时更新；禁用灰显 | ✅ |
| "Agent 管理 >" 单行不换行 | ✅ |
| 能力标签中文 + emoji（3~5 个） | ✅ |
| PPT 文件变更白名单过滤 | ✅ |
| Planner 正常分工 + 中文输出 | ✅ |
| degradedPlan 单 Agent 不重复 | ✅ |
| DAG 依赖调度 | ✅ |
| Follow-up 修复（不出重复计划） | ✅ |
| 文件多轮修改预览刷新 | ✅ |
| 能力标签中文 + emoji（内置/自建统一） | ✅ |
| OpenCode 内置 Agent（seed + Badge） | ✅ |
| 新建对话默认工作目录 | ✅ |
| 工作区文件刷新按钮 | ✅ |
| TypeScript 编译 server + web | ✅ |

---

## 七、Git 提交记录

| Commit | 说明 |
|---|---|
| `b63c4e5` | Docs: update 4.5 plan |
| `3ff39f7` | Feat: 4.5 User Agent Management |
| `9e953e3` | Fix: PPT allow-list filter + capability emoji fallback |
| `4f9d480` | Docs: add bug items |
| `1ccc643` | Fix: Planner follow-up message handling |
| `17e29c5` | Fix: file preview not refreshing on subsequent modifications |
| `34fdd05` | Docs: update todo + zyw merge (agent data loss fix, enabled filter) |
| 未提交 | Feat: OpenCode built-in agent + capability Chinese labels + workspace refresh + default working dir |
