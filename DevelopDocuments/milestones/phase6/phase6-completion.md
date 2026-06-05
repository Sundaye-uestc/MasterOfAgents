# Phase 6 开发完成文档

**完成日期：** 2026-06-04

---

## 概述

Phase 6 实现 4.5 用户 Agent 管理——用户可通过对话式弹窗创建自定义 AI Agent，LLM 自动解析自然语言描述生成结构化配置，支持编辑 System Prompt、AI 润色、工具集自动匹配，以及完整的 Agent 管理界面（启用/禁用、编辑、删除）。

同时修复了 PPT 操作时文件变更预览过多的问题（白名单模式）和能力标签 emoji fallback 问题。

---

## 一、4.5 用户 Agent 管理

### 1.1 功能清单

| 子项 | 功能 | 状态 |
|---|---|---|
| 4.5.1 | 对话式创建 Agent（弹窗，LLM 解析） | ✅ |
| 4.5.2 | 自定义 System Prompt 编辑 + AI 润色 | ✅ |
| 4.5.3 | 工具集配置（10 个预定义集，LLM 自动匹配） | ✅ |
| 4.5.4 | Agent 管理界面（侧边栏面板，启用/禁用/编辑/删除） | ✅ |
| — | `GET /api/agents?enabled=true\|false` 过滤 | ✅ |

### 1.2 新建文件

| 文件 | 说明 |
|---|---|
| `packages/shared/src/tool-sets.ts` | 10 个工具集定义（PPT、文档、数据、前端、后端、调试、文件、搜索、测试、安全），含中英文关键词匹配 `matchKeywords`，`getToolSetById()`，`getToolSetPromptInjection()`，`stripToolSetInjection()`，`matchToolSetsByKeywords()` |
| `apps/server/src/services/agent-builder.service.ts` | `AgentBuilderService` 类：`parseCreationIntent()` 解析用户自然语言描述为结构化配置，`polishSystemPrompt()` 润色草稿 System Prompt，复用 PlannerService 的多厂商 LLM 调用模式（Anthropic + 7 个 OpenAI 兼容厂商） |
| `apps/web/src/components/agent/AgentCreationModal.tsx` | 两步弹窗：Step "chat"（用户输入描述 → `parseCreationIntent()`）→ Step "preview"（可编辑 name/systemPrompt/capabilities/toolSets + AI 润色按钮 → 确认创建） |
| `apps/web/src/components/agent/AgentEditModal.tsx` | 编辑弹窗：名称、SystemPrompt textarea、能力标签、工具集网格；AI 润色按钮调用 `polishSystemPrompt()` |
| `apps/web/src/components/agent/AgentDetailModal.tsx` | 只读详情弹窗：AgentBadge、状态、能力标签、工具集、SystemPrompt 代码块、时间戳 |
| `apps/web/src/components/agent/AgentDeleteConfirmModal.tsx` | 删除确认弹窗：Agent 名称 + 警告文案 + 确认/取消 |
| `apps/web/src/components/agent/AgentManagePanel.tsx` | 全屏管理面板：Header（"Agent 管理" + "新建 Agent" + 关闭）、自建/内置分区列表、每行 AgentBadge + 能力标签 + 启用开关 + 编辑/详情/删除按钮、右键菜单 |

### 1.3 修改文件

| 文件 | 说明 |
|---|---|
| `packages/shared/src/types/db.ts` | 新增 `ParsedAgentIntent`（name/platform/systemPrompt/capabilities/toolSetIds）和 `PolishPromptResponse` 类型 |
| `packages/shared/src/index.ts` | 导出 `tool-sets.ts` |
| `apps/server/src/routes/agents.ts` | 8 个端点：GET `/`（`?enabled=true\|false`）、POST `/`、POST `/from-draft`（增强 toolSetIds）、POST `/parse-intent`（新）、POST `/polish-prompt`（新）、GET `/:id`、PATCH `/:id`（增强 capabilities/toolSetIds/avatar）、DELETE `/:id`（仅允许 isCustom=1） |
| `apps/web/src/lib/api.ts` | 新增 `getAgent()`、`updateAgent()`、`deleteAgent()`、`parseCreationIntent()`、`polishSystemPrompt()` |
| `apps/web/src/stores/agent.store.ts` | 新增 `update()`、`remove()`、`toggleEnabled()`，乐观本地更新 |
| `apps/web/src/App.tsx` | 侧边栏底部改造：左侧头像 + "我" \| 竖线分割 \| 右侧 ⚙️ "Agent 管理 >"（单行不换行）；打开 `AgentManagePanel` |

---

## 二、LLM 能力标签中文化

AI 生成的能力标签改为中文 + emoji 前缀，3~5 个：

**Prompt 规则更新**（`agent-builder.service.ts`）：
- `buildParseIntentPrompt`：capabilities 从 `"小写英文标签"` → `"中文标签，每个以 emoji 开头（如 📊 数据分析），3~5个即可"`
- `buildPolishPrompt`：同上

**前端适配**（`ChatArea.tsx`）：
- 新增 `startsWithEmoji()` 检测函数（`/^\p{Emoji}/u`）
- 自带 emoji 的标签直接原样渲染，不再走 `capabilityEmoji() + capabilityLabel()` 管道
- 旧式英文标签（如 `debugging`）继续走原有 emoji + 中文翻译路径
- 修复了 fallback `⚡` 总是出现在自建 Agent 标签前的问题

---

## 三、PPT 文件变更白名单过滤

**问题**：Agent 修改 PPT 时操作大量内部文件（XML、脚本、配置），前端文件变更预览出现几十个无意义卡片。

**修复**（`agent-runtime.service.ts`）：

| 模式 | 条件 | 行为 |
|---|---|---|
| **白名单（新）** | 检测到任意 `.pptx` 创建/修改 | 仅展示 `.pptx` 文件变更 + 生成 HTML 预览 |
| 黑名单（原有） | 无 `.pptx` 变更 | 过滤 `slide-*.png`、`prompts.json`、`slides_plan.json`、`.js` |

`shouldSkipFile` 函数新增 `isPPTMode` 检测逻辑，同步影响 WebSocket 广播和 artifact 创建。PPTX 预览生成（`pptx_to_preview.py` → HTML slideshow）独立于过滤逻辑，不受影响。

---

## 四、ESM Hoisting API Key 修复

**问题**：`POST /api/agents/parse-intent` 返回 404 / "No API key configured"。

**根因**：ESM 静态 `import` 在 `dotenv.config()` 执行前求值。`config.ts` 的 `config.plannerApiKey` 等值在模块加载时为空，`AgentBuilderService` 构造函数引用了这些已过期的静态值。

**修复**（`agent-builder.service.ts` 构造函数完全重写）：
- 不再使用任何 `config.*` 静态值
- 所有 provider 配置（endpoint、model）硬编码在 `providerDefaults` 映射中
- API key 通过 `resolveEnvApiKey()` 在构造时从 `process.env` 动态读取（dotenv 已加载）
- `resolveEnvApiKey()` 支持 8 个 provider 各自的 env key 名称（`DEEPSEEK_API_KEY`、`ANTHROPIC_API_KEY` 等）
- 修复了 `"" ?? fallback` 不过滤空字符串的问题（改用 `||`）

---

## 五、工具集系统

### 5.1 10 个预定义工具集

| ID | 标签 | 图标 | 核心能力 |
|---|---|---|---|
| `ppt` | PPT 生成 | 📊 | pptxgenjs + Gemini AI 幻灯片 |
| `docs` | 文档撰写 | 📝 | Markdown、技术文档、README |
| `data` | 数据分析 | 📈 | 数据处理、可视化、报表 |
| `frontend` | 前端开发 | 🎨 | HTML/CSS/JS/React/Vue |
| `backend` | 后端开发 | ⚙️ | Node/Python/Go API |
| `debug` | 代码调试 | 🔧 | 错误定位、日志分析、性能诊断 |
| `file` | 文件管理 | 📁 | 批量重命名、格式转换、搜索 |
| `search` | 网络搜索 | 🔍 | 信息检索、网页抓取 |
| `test` | 测试编写 | 🧪 | 单元测试、集成测试、覆盖率 |
| `security` | 安全审查 | 🔒 | 漏洞扫描、依赖检查、代码审计 |

### 5.2 工具集匹配与注入

- `matchToolSetsByKeywords(description, capabilities)`：基于中英文关键词匹配，从用户描述和能力标签中计算匹配分数
- `getToolSetPromptInjection(toolSetIds)`：生成 `【工具集配置】` 标记 + 各工具集描述文本
- `stripToolSetInjection()`：更新时移除旧注入片段再追加新片段
- 注入文本追加到 Agent System Prompt 末尾

---

## 六、关键架构决策

| 决策 | 说明 |
|---|---|
| Agent 创建用弹窗而非独立路由 | 用户明确要求，Modal overlay 在当前页面之上 |
| ESM hoisting 绕过方案 | `AgentBuilderService` 构造函数内直接从 `process.env` 读取，不依赖 `config.ts` 静态值 |
| 工具集注入 System Prompt | 追加 `【工具集配置】` 段落，更新时 strip + re-append |
| 能力标签中文化 + emoji | LLM prompt 约束输出格式，前端检测 emoji 前缀自动适配 |
| 前端无路由库 | 条件渲染 + useState 控制面板/弹窗显隐 |
| Drizzle 条件查询 | SQLite 不支持链式 `.where()` 类型推断，用独立 `if` 分支完整查询 |

---

## 七、验证结果

| 验证项 | 状态 |
|---|---|
| `POST /api/agents/parse-intent` — "帮我做一个擅长PPT的Agent" → 结构化 JSON | ✅ |
| `POST /api/agents/polish-prompt` — 草稿 → 优化后 SystemPrompt + 能力标签 | ✅ |
| `POST /api/agents/from-draft` — toolSetIds 注入 configJson | ✅ |
| `DELETE /api/agents/{custom-id}` → 200；`DELETE /api/agents/default-claude` → 400 | ✅ |
| `GET /api/agents?enabled=true` → 仅返回启用 Agent | ✅ |
| 前端：创建弹窗 → 列表出现 → AgentPicker 可选 | ✅ |
| 前端：编辑 → 即时更新；禁用 → 灰显 | ✅ |
| "Agent 管理 >" 单行显示不换行 | ✅ |
| 能力标签中文 + emoji（3~5个） | ✅ |
| PPT 文件变更白名单过滤 | ✅ |
| TypeScript 编译 server + web | ✅ |

---

## 八、Git 提交记录

| Commit | 说明 |
|---|---|
| `b63c4e5` | Docs: update 4.5 plan — modal instead of route, Agent管理 naming, enabled filter |
| `3ff39f7` | Feat: 4.5 User Agent Management — full-stack custom agent CRUD |
| `9e953e3` | Fix: PPT allow-list filter + capability emoji fallback + TS errors |
| `4f9d480` | Docs: add bug items — PPT preview after edit, agent data loss on refresh |

---

## 九、群聊 Planner 修复（Phase 6 追加）

### 9.1 ESM Hoisting API Key 修复 — Planner 永远失败的根因

`config.ts` 的 `resolveApiKey()` 在 ESM import 时（`dotenv.config()` 之前）执行，API key 为空 → Planner 始终 fallback 到 `degradedPlan`。**与 `AgentBuilderService` 完全相同的 bug。**

**修复**：`PlannerService` 构造函数重写，绕过 `config.*` 静态值，直接从 `process.env` 运行时读取。新增 `resolveEnvApiKey()` 支持 8 个 provider。移除 `config` import。

### 9.2 Planner Prompt 强化

| 改动 | 说明 |
|---|---|
| Agent 能力附带 | `名称（ID）` → `名称（ID）— 擅长：xxx、xxx` |
| 无 @ 分配规则 | "用户未 @ 时，必须将工作分配给所有相关 Agent" |
| 能力匹配规则 | "根据 Agent 的能力描述，分配给最擅长该领域的 Agent" |
| 输出中文化 | 首条关键规则："所有输出字段必须使用中文" |
| 任务边界 | "每个 task 的 description 只写该 Agent 自己要做的事"、"注明只做 XXX，不要做 YYY" |
| `preprocessMentions` | 无 @ 时注入提示要求自行分配 Agent |

### 9.3 degradedPlan 策略

- **之前**：每个 Agent 收到相同完整 prompt → 所有人做相同工作（重复）
- **之后**：只给第一个 Agent 单任务。宁可少做不重复；Planner prompt 优化后 fallback 极低

### 9.4 Agent 名称显示

`orchestrator.service.ts` 两处：计划摘要 `任务1 → default-codex` → `任务1 → Codex`；任务完成后从 DB 查真实名称而非用 ID

### 9.5 前端：移除行内文件变更卡片

`ChatArea.tsx` 移除 `InlineDiffCard` 渲染块（工作区面板已覆盖）

### 9.6 Follow-up 消息重复计划修复

**问题**：用户对执行结果提出 BUG 反馈后，Planner 再次输出与第一次完全相同的任务分解。例如用户说 "网页有 BUG ⚠️ JSON.parse error"，Planner 仍分解为 "创建 data.json + 创建 HTML"，导致 Claude 不必要地重新检查已存在的文件。

**根因**：`startOrchestratedRun()` 每次都调用 Planner，prompt 固定为 "将以下用户请求拆分为子任务"，没有 "后续消息/反馈" 的上下文感知。

**修复**（两个文件）：

| 文件 | 改动 |
|------|------|
| `orchestrator.service.ts` | 调用 Planner 前查询该对话是否有已完成的编排 run。如果有，在 prompt 头部注入 `[上下文：这是用户对上一轮任务执行结果的反馈...]` 提示，引导 Planner 创建修复任务而非重新分解 |
| `planner.service.ts` | 关键规则中加入对应指令，识别 `[上下文：...]` 标记 → 只创建修复/改进任务（通常 1 个），不重复已完成的任务 |

### 9.7 DAG 依赖调度验证

**测试用例**："先用一个 Agent 写 data.json，再用另一个 Agent 写 HTML 读取并展示成绩表格"

| 验证项 | 结果 |
|--------|------|
| Planner 正确分解为 2 个任务并设置依赖（task-2 依赖 task-1） | ✅ |
| 任务按 DAG 顺序执行（task-1 完成 → task-2 启动） | ✅ |
| 文件传递正常（HTML 能读到 data.json） | ✅ |
| Follow-up BUG 修复（只出 1 个修复任务，不再重复原始计划） | ✅ |

---

## 十、验证状态

- [x] Planner LLM 正常工作时，验证分工正确且输出中文
- [x] Planner LLM 失败时，验证 degradedPlan 单 Agent 执行不重复
- [x] 非并行任务（有依赖关系）：DAG 调度正确性、文件传递、writeScope 冲突
- [x] Follow-up 消息处理：Planner 识别反馈/修复请求，不重复出原始计划
