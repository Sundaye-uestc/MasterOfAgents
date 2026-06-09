# Phase 6 开发完成文档

**完成日期：** 2026-06-05

> **最后更新：** 2026-06-09 — 群聊头像拼图 + 成员管理优化 + 代码编辑器（Monaco Editor）+ 产物去重 & 归属修复 + 自建 Agent 头像修复

---

## 概述

Phase 6 实现 4.5 用户 Agent 管理 + 群聊 Planner 修复与验证，以及后续工作区代码编辑器。

- **Agent 管理**：对话式弹窗创建自定义 Agent，LLM 解析自然语言 → 结构化配置，支持 System Prompt 编辑/AI 润色/工具集自动匹配，完整 CRUD 管理界面
- **Planner 修复**：ESM hoisting API Key 修复、Prompt 强化（中文输出/任务边界/能力匹配/闲聊识别）、DAG 依赖调度验证、Follow-up 消息处理修复、Agent 上下文隔离
- **代码编辑器**：Monaco Editor 集成（VS Code 同款引擎），工作区多标签页编辑器，Ctrl+S 保存 + 后端文件写入 API，"查看代码"按钮从产物卡片跳转编辑器
- **产物去重 & 归属**：修复群聊编排模式下产物跨 Agent 重复播报和归属错误，实现按轮次所有权分配 + 文件名去重 + 跨轮重置的三层过滤
- **自建 Agent 头像修复**：修复对话页 Header 和消息列表中自建 Agent 头像不显示的问题（Web + Mobile 共 9 个文件）
- **其他修复**：PPT 文件变更白名单过滤、能力标签 emoji fallback、文件预览去重（跨轮展示 + 同轮去重）

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
| `apps/web/src/components/workspace/CodeEditorPanel.tsx` | Monaco 编辑器 + 多标签页 + 脏标记 + Ctrl+S 保存 |
| `apps/web/src/stores/edit-file.store.ts` | 跨组件编辑文件通信 store（TextPreviewCard → CodeEditorPanel） |
| `apps/web/public/agents/opencode.png` | OpenCode 头像（从根目录复制） |
| `apps/web/src/components/chat/GroupAvatar.tsx` | 群聊头像拼图组件（CSS Grid，类微信风格） |

### 1.2 修改文件

| 文件 | 说明 |
|---|---|
| `packages/shared/src/types/db.ts` | 新增 `ParsedAgentIntent`、`PolishPromptResponse` 类型 |
| `packages/shared/src/index.ts` | 导出 `tool-sets.ts` |
| `apps/server/src/routes/agents.ts` | 8 个端点：GET（`?enabled` 过滤）/ POST / POST from-draft / POST parse-intent / POST polish-prompt / GET :id / PATCH :id / DELETE :id |
| `apps/server/src/routes/workspaces.ts` | 新增 `PUT /:id/file-content` 端点 — 接收文件内容写入 workspace 目录 |
| `apps/server/src/services/workspace.service.ts` | 新增 `writeFileContent()` — 路径穿越防护 + UTF-8 写入 |
| `apps/server/src/db/seed.ts` | 新增 `default-opencode` 内置 Agent |
| `apps/web/src/lib/api.ts` | `listAgents(enabledOnly?)` 过滤参数 + `writeWorkspaceFile()` |
| `apps/web/src/stores/agent.store.ts` | `update()` / `remove()` / `toggleEnabled()` |
| `apps/web/src/App.tsx` | 侧边栏 "Agent 管理 >" + `agentStore.load()` 初始化 |
| `apps/web/package.json` | 添加 `@monaco-editor/react` 依赖 |
| `apps/web/src/components/chat/CapabilityTags.tsx` | 集中管理 emoji + 中文标签映射，导出 `formatCapability()` |
| `apps/web/src/components/chat/AgentBadge.tsx` | 新增 `opencode` logo 映射 |
| `apps/web/src/components/chat/ConversationList.tsx` | 默认工作目录 `D:/Projects/MasterOfAgents/Test` + 启用过滤 |
| `apps/web/src/components/workspace/WorkspacePanel.tsx` | "文件"标签添加 SVG 刷新按钮 + 新增「代码」标签页 + 文件树点击打开编辑器 |
| `apps/web/src/components/artifact/TextPreviewCard.tsx` | 添加"查看代码"按钮 → 跳转工作区编辑器 |
| `apps/web/src/components/artifact/WebPreviewCard.tsx` | 添加"查看代码"按钮 → 跳转工作区编辑器 |
| `apps/server/src/services/planner.service.ts` | ESM hoisting 绕过 + Prompt 强化 + follow-up 规则 + 闲聊识别 |
| `apps/server/src/services/orchestrator.service.ts` | Follow-up 检测 + DAG 调度 + Agent 名称映射 |
| `apps/server/src/services/chat.service.ts` | `buildAgentContext` 过滤带 `runId` 的 system 消息（防止计划泄露给 Agent） |
| `apps/web/src/components/chat/ChatArea.tsx` | 移除 InlineDiffCard + artifact 去重（同轮按 path 去重保留最新，跨轮不去重） + 复用 `formatCapability` |
| `apps/web/src/components/agent/AgentEditModal.tsx` | 能力标签中文显示 |
| `apps/web/src/components/agent/AgentManagePanel.tsx` | 能力标签中文显示 |
| `apps/web/src/components/agent/AgentDetailModal.tsx` | 能力标签中文显示 |
| `apps/web/src/components/chat/ChatArea.tsx` | Header 群成员 ··· 菜单（信息/移除/新增→管理面板） |
| `apps/web/src/components/chat/ConversationList.tsx` | 群聊侧边栏 GroupAvatar + membersMap + 管理面板 AgentPicker 图形选人 |
| `apps/web/src/components/chat/AgentBadge.tsx` | 导出 logos + rounded 属性（md/full）+ sm 尺寸调整 |
| `start_dev.py` | 修复 Windows 端口检测死锁（回退到原始 time.sleep 方案） |
| `apps/web/src/components/chat/ChatArea.tsx` | 产物去重（perRoundOwnerMaps + 文件名去重 + 跨轮重置）+ `MemberInfo` 增加 `avatar` + `directAgentAvatar` state |
| `apps/mobile/src/pages/ChatPage.tsx` | `MemberInfo` 增加 `avatar`；`nameMap` 增加 `avatar` |
| `apps/mobile/src/components/mobile-chat/MobileMessageList.tsx` | 产物去重（同 Web）+ `AgentInfo` 增加 `avatar` |
| `apps/mobile/src/components/mobile-chat/MobileMessageBubble.tsx` | `AgentInfo` 增加 `avatar`；`AgentBadge` 传入 `avatar` |
| `apps/mobile/src/components/mobile-chat/MobileMemberSheet.tsx` | `MemberInfo` 增加 `avatar`；`AgentBadge` 传入 `avatar` |
| `apps/mobile/src/components/mobile-chat/MobileConversationItem.tsx` | `AgentInfo`/`members` 增加 `avatar`；`AgentBadge` 传入 `avatar` |
| `apps/mobile/src/components/mobile-chat/MobileMentionPicker.tsx` | `MemberInfo` 增加 `avatar`；`AgentBadge` 传入 `avatar` |
| `apps/mobile/src/pages/ConversationListPage.tsx` | `membersMap`/`manageMembersList` 增加 `avatar`；`AgentBadge` 传入 `avatar` |
| `README.md` | 顶部增加 `[English](README_EN.md)` 语言切换链接 |
| `README_EN.md` | **新建** — README 完整英文翻译 |

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
| 闲聊识别 | 首条规则：判断用户意图，纯闲聊（问候/感谢/打招呼）→ 每个 Agent 各创建 1 个回复 task，不涉及代码 |
| 无 @ 分配 | 编程任务分配给最合适的 1~2 个 Agent，不过度拆分 |
| 能力匹配 | 根据能力描述分配给最擅长的 Agent |
| 输出中文化 | 所有输出字段必须使用中文 |
| 任务边界 | description 只写该 Agent 自己的事，注明边界 |
| `preprocessMentions` | 无 @ 时温和提示，不强制"分配给所有 Agent" |
| degradedPlan | 只给第一个 Agent 单任务（之前：每人一份完整 prompt → 重复工作） |

### 3.3 Follow-up 消息处理

**问题**：用户对执行结果反馈 BUG 后，Planner 再次输出与第一次完全相同的任务分解。

**修复**：`startOrchestratedRun()` 查询对话是否有已完成的编排 run，有则在 prompt 头部注入 `[上下文：这是用户对上一轮任务执行结果的反馈...]` 提示；Planner prompt 加入对应识别规则。

### 3.4 DAG 依赖调度验证

| 测试用例 | 验证项 | 结果 |
|---|---|---|
| 2 Agent：创建 data.json → 写 HTML 读取展示 | Planner 分解 2 任务 + 依赖关系 | ✅ |
| | 按 DAG 顺序执行（task-1 完成 → task-2 启动） | ✅ |
| | 文件传递正常 | ✅ |
| 3 Agent：创建 data.txt → 写 Python 脚本 → 运行验证写 result.txt | Planner 分解 3 任务链式依赖（task-1 → task-2 → task-3） | ✅ |
| | 严格顺序执行，文件在 Agent 间正常传递 | ✅ |
| | 每个 Agent 只做自己的任务，不越界 | ✅ |
| Follow-up BUG 修复（只出 1 个修复任务） | ✅ |
| Planner 输出全中文 | ✅ |

### 3.5 Agent 上下文隔离

**问题**：`buildAgentContext` 将所有消息（包括 Planner 的计划摘要和完成通知这些带 `runId` 的 system 消息）传给每个 Agent → Agent 看到完整任务计划后越界执行其他 Agent 的活。

**修复**：`buildAgentContext` 过滤 `role === "system" && runId` 的消息，仅保留用户消息、Agent 消息和无 `runId` 的 system 消息。

### 3.6 闲聊识别

**问题**：用户输入"你们好"，Planner 创建 3 个代码任务（写代码→审查→调试），用力过猛。

**修复**：
- Planner prompt 首条规则：先判断用户意图，纯闲聊 → 每个 Agent 创建 1 个简单回复 task，不涉及代码
- `preprocessMentions` 不再强制"分配给所有 Agent"，改为温和提示

---

## 四、文件预览去重修复（含群聊产物归属）

### 4.1 Phase 6 — 跨轮展示 + 同轮去重

**问题**：同一文件多轮修改时，预览只在第一次出现。根因：`ChatArea.tsx` 跨 run 文件名去重逻辑阻止了后续 run 中同文件名的 artifact 展示。

**修复**：跨 run 不去重（每次修改都要显示），同 run 内按 path 去重保留最新版本（避免同一轮内 Agent A 创建 + Agent B 修改导致同一文件出现两次）。PPT 白名单过滤（`shouldSkipFile`）在服务端，不受影响。

### 4.2 后 Phase 6 — 群聊编排模式产物归属 & 跨 Agent 去重

**问题**：群聊 Orchestrator 模式下，3 个 Agent 各自创建一个文件，但：
1. 每个 Agent 消息下方展示全部 3 个文件的产物卡片（9 张）
2. 去重后全部卡片归到第一个 Agent，而非各自展示自己的产物
3. 迭代对话中同名文件仅第一次展示，后续迭代被屏蔽

**根因**：共享 workspace 下，每个 Agent 运行后的快照对比检测到了 workspace 中所有文件（包括前面 Agent 创建的），服务端为每个 Agent 都生成了全部文件的 artifact。这些 artifact 的 `path` 字段是 `"artifacts/{uuid}/filename"`，每个 artifact 有独立 UUID，导致路径字符串去重失效。

**修复过程**（4 轮迭代）：

| 轮次 | 方案 | 失败原因 |
|---|---|---|
| 1 | 路径去重 `a.path` | `a.path = "artifacts/{uuid}/filename"`，UUID 不同 → 路径不等 |
| 2 | `messageId` 精确匹配 | 服务端为每个 Agent 报全部文件，每个 artifact 绑定当前 Agent 的 `messageId` → 全部 `match=true` |
| 3 | `a.name` 文件名去重 | 去重成功但全部归到消息列表中第一个 Agent；跨轮同名文件被屏蔽 |
| **4** | **按轮次所有权 + 文件名去重 + 跨轮重置** | ✅ |

**最终方案 — 三层过滤**：

```
Layer 1 — perRoundOwnerMaps[currentRound]
  每条用户消息启动新一轮 → 独立计算所有权
  轮内按 createdAt 排序，每个文件名分配给最早创建它的 runId
  → 每个 Agent 只展示自己真正创建的文件

Layer 2 — shownInThisRound
  轮内文件名去重（防御层）

Layer 3 — 用户消息触发 currentRoundIndex++ + shownInThisRound.clear()
  跨轮重置 → 迭代后的同名文件（如 PPT 修改）可重新展示
```

**修改文件**：
- `ChatArea.tsx` — 预计算 `perRoundOwnerMaps`（按轮次分组 artifact，独立排序分配），渲染时检查 `ownerMap.get(a.name) === msg.runId`
- `MobileMessageList.tsx` — 同样的预计算和过滤逻辑

---

## 五、群聊 UX 优化

### 5.1 群聊头像拼图（GroupAvatar）

CSS Grid 实现的微信风格群聊头像拼接：

- **布局**：用户头像在首位，各 Agent 头像按顺序填充网格
- **自适应**：≤2 人 → 2 列，≤4 人 → 2×2，5~9 人 → 3×3（最多 9 格）
- **圆角策略**：侧边栏 `rounded-md`（方角），对话页 Header `rounded-full`（圆形）
- **Agent 头像**：使用真实 logo（导出 `logos` 映射），自定义 Agent 用彩色底 + 首字母 fallback
- **用户头像**：上传则用真实图片，否则 `👤` 占位

| 位置 | 单聊 | 群聊 |
|------|------|------|
| 侧边栏 (ConversationList) | AgentBadge `rounded-md` | GroupAvatar `rounded-md` |
| 对话页 Header | 不显示头像 | 横向排列圆形 AgentBadge `rounded-full` |

### 5.2 群成员 ··· 菜单

群聊 Header 中 Agent 头像右侧新增 `···` 按钮，点击弹出下拉菜单：

- **成员列表**：每行显示圆形头像、名称、Host 标识👑、能力标签（emoji + 中文）
- **❌️ 移除**：点击调用 `DELETE /conversations/:id/members/:agentId`，即时更新
- **➕ 新增**：点击唤起已有的"管理群成员"面板（复用 ConversationList 中的模态框）
- **管理面板**：添加成员使用 `AgentPicker` 图形化选择（替代 `<select>` 下拉），带头像/名称/类型，点击高亮蓝框 + ✓

### 5.3 AgentBadge 增强

- 导出 `logos` 映射 → `GroupAvatar` 复用 Agent 真实 logo
- 新增 `rounded` 属性：`"md"`（方角，默认侧边栏）/ `"full"`（圆形，Header）
- `sm` 尺寸从 `w-5` → `w-7`，与 GroupAvatar 容器对齐

### 5.4 自建 Agent 头像在对话页不显示 — 修复

**问题**：对话列表（ConversationList）中自建 Agent 的 avatar 正确显示（`agent.avatar` 传入了 `AgentBadge`），但对话页（ChatArea）Header、成员菜单和消息列表中的 `AgentBadge` 始终只显示平台默认 logo。

**根因**：
- Web `ChatArea.tsx`：`MemberInfo` 接口缺少 `avatar` 字段；三处 `AgentBadge` 调用均未传 `avatar`；单聊模式下也未从 `listAgents()` 中提取 avatar
- Mobile 整条链路（`ChatPage.tsx` → `MobileMessageList` → `MobileMessageBubble`）：`AgentInfo`/`MemberInfo` 接口和 `nameMap` 均缺少 `avatar` 字段传递
- 涉及 Web 1 个文件 + Mobile 8 个文件

**修复**：
- `ChatArea.tsx`：`MemberInfo` 增加 `avatar?: string | null`；新增 `directAgentAvatar` state（单聊从 `listAgents()` 中提取）；Header 成员头像、成员菜单下拉、消息列表三处 `AgentBadge` 均传入 `avatar`
- Mobile 链路：各级 `AgentInfo`/`MemberInfo` 接口补齐 `avatar`；`nameMap` 取值时携带 `avatar`；所有 `AgentBadge` 调用传入 `avatar`

---

## 六、工作区代码编辑器（Monaco Editor）

`@monaco-editor/react` — VS Code 同款编辑器引擎，仅 5MB（gzip ~1.5MB），React 19 兼容，通过 `React.lazy` 懒加载避免阻塞首屏。

### 6.1 CodeEditorPanel 组件

| 功能 | 实现 |
|---|---|
| 多标签页 | 点击文件树打开文件 → 新增标签页，支持切换/关闭（✕），脏标记（蓝色圆点） |
| 语法高亮 | 根据文件扩展名自动检测语言（TS/JS/Python/Go/HTML/CSS/JSON/YAML 等 20+ 种） |
| 保存 | Ctrl+S 快捷键 + 标签栏保存按钮 → `PUT /api/workspaces/:id/file-content` → 写入磁盘 |
| 脏标记 | 内容变更后标签显示蓝点 + 保存按钮出现，保存成功后消失 |
| 容错 | 二进制文件提示"无法打开"，>500KB 降级为只读，竞态去重防双重加载 |

### 6.2 后端文件写入

`PUT /api/workspaces/:id/file-content?path=xxx`，body `{ content: string }`。`writeFileContent()` 在写入前做路径穿越防护：`path.resolve(rootPath, filePath)` 后校验结果是否以 `rootPath` 为前缀。

### 6.3 跨组件联动

`useEditFileStore`（Zustand）作为信号总线：TextPreviewCard / WebPreviewCard 调用 `editFile(name)` → WorkspacePanel 的 `useEffect` 检测到 `pendingFilePath` 变化 → 切换到「代码」标签页并打开文件 → 调用 `clear()` 重置。

---

## 七、关键架构决策

| 决策 | 说明 |
|---|---|
| Agent 创建用弹窗而非独立路由 | 用户明确要求，Modal overlay 在当前页之上 |
| ESM hoisting 绕过 | 构造时从 `process.env` 动态读取，不依赖 `config.ts` 静态值 |
| 工具集注入 System Prompt | 末尾追加 `【工具集配置】` 段落，更新时 strip + re-append |
| 能力标签中文化 + emoji | LLM prompt 约束输出，前端检测 emoji 前缀自动适配 |
| Drizzle 条件查询 | SQLite 不支持链式 `.where()` 类型推断，用独立 `if` 分支 |
| Follow-up 检测 | 查询 prior completed/failed runs → 注入上下文提示 |
| 文件预览去重策略（单 Agent） | 跨 run 不去重（每次修改都展示），同 run 按 path 去重保留最新（避免同轮重复） |
| 产物归属分配（群聊编排） | 前端按轮次计算所有权（`perRoundOwnerMaps`）：轮内 artifact 按 `createdAt` 排序，每个文件名分配给最早创建它的 `runId` → 每 Agent 只展示自己创建的产物。用户消息触发跨轮重置 → 迭代同名文件可重新展示 |
| Agent 上下文隔离 | `buildAgentContext` 过滤 `runId` 的 system 消息，防止计划泄露导致越界 |
| Planner 闲聊识别 | 判断用户意图，纯闲聊 → 每个 Agent 回复而非代码任务 |
| Monaco 懒加载 | `React.lazy(() => import("@monaco-editor/react"))` + Suspense fallback，避免 5MB 阻塞首屏 |
| 路径穿越防护 | 写入前 `path.resolve` + `startsWith` 校验，拒绝越界路径 |
| 跨组件编辑通信 | Zustand store 信号模式（set → detect → clear），解耦 TextPreviewCard 与 CodeEditorPanel |

---

## 八、验证结果

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
| DAG 3 Agent 链式依赖（data.txt → Python 脚本 → 验证写入 result.txt） | ✅ |
| Agent 上下文隔离（不泄露计划给单 Agent） | ✅ |
| 闲聊识别（"你们好"→ 回复任务，非代码任务） | ✅ |
| 同轮文件去重（同 run 同 path 只保留最新） | ✅ |
| Follow-up 修复（不出重复计划） | ✅ |
| 文件多轮修改预览刷新 | ✅ |
| 能力标签中文 + emoji（内置/自建统一） | ✅ |
| OpenCode 内置 Agent（seed + Badge） | ✅ |
| 新建对话默认工作目录 | ✅ |
| 工作区文件刷新按钮 | ✅ |
| TypeScript 编译 server + web | ✅ |
| 群聊头像拼图（侧边栏 GroupAvatar + Header 圆形排列） | ✅ |
| 群成员 ··· 菜单（信息/能力标签/移除） | ✅ |
| 管理面板图形化选人（AgentPicker） | ✅ |
| 管理面板添加/移除成员 | ✅ |
| AgentBadge rounded 属性 + 尺寸对齐 | ✅ |
| start_dev.py 修复（回退到简单 time.sleep 方案） | ✅ |
| Monaco Editor 多标签页打开/切换/关闭 | ✅ |
| Ctrl+S 保存 → 后端写入磁盘 | ✅ |
| 语法高亮（TS/JS/Python/HTML/CSS/JSON 等 20+ 语言） | ✅ |
| "查看代码"按钮（WebPreviewCard + TextPreviewCard）跳转编辑器 | ✅ |
| 路径穿越防护 | ✅ |
| 二进制文件降级提示 | ✅ |
| 懒加载（Suspense fallback） | ✅ |
| 自建 Agent 头像在单聊对话页 Header 显示 | ✅ |
| 自建 Agent 头像在群聊对话页 Header + 成员菜单 + 消息列表显示 | ✅ |
| Mobile 链路自建 Agent 头像（ConversationList + Chat + MemberSheet + MentionPicker） | ✅ |
| 群聊编排每 Agent 只展示自己创建的产物 | ✅ |
| 同一轮内同名文件只展示一次 | ✅ |
| 迭代对话中同名文件（PPT 等）跨轮可重新展示 | ✅ |
| 产物归属 `perRoundOwnerMaps` 计算正确（按 createdAt 最早者分配） | ✅ |

---

## 九、Git 提交记录

| Commit | 说明 |
|---|---|
| `b63c4e5` | Docs: update 4.5 plan |
| `3ff39f7` | Feat: 4.5 User Agent Management |
| `9e953e3` | Fix: PPT allow-list filter + capability emoji fallback |
| `4f9d480` | Docs: add bug items |
| `1ccc643` | Fix: Planner follow-up message handling |
| `17e29c5` | Fix: file preview not refreshing on subsequent modifications |
| `34fdd05` | Docs: update todo + zyw merge (agent data loss fix, enabled filter) |
| `376a708` (已回退) | Feat: OpenCode built-in agent + capability Chinese labels + workspace refresh + default working dir |
| 未提交 | Fix: Planner casual conversation + Agent context isolation + intra-run artifact dedup |
| 未提交 | Feat: 群聊头像拼图 + 成员管理菜单 + AgentPicker 图形化选人 + 管理面板复用 |
| 未提交 | Fix: start_dev.py 回退到原始简单方案（time.sleep + netstat port cleanup） |
| `f3f30e1` (PR #4) | Feat: Monaco Editor — 代码编辑器 + 查看代码按钮 + 后端文件写入 API |
| `7df04f3` | Docs: add English README with language switcher |
| `89e6dc8` | Fix: Agent custom avatar not shown in chat page header and message list |
| （待提交） | Fix: artifact dedup — per-round ownership + name-based dedup |
