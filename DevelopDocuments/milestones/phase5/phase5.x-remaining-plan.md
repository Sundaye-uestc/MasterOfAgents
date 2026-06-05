# 待完成事项详细规划方案

**日期：** 2026-06-05

---

## 一、Codex CLI 安装与端到端验证

**当前状态**：运行时自动降级为 ClaudeCodeAdapter，代码已完成，缺少 CLI 安装和验证。

### 实施步骤

1. **安装 Codex CLI**
   - 检查 `codex` 二进制是否已存在
   - 如缺失：`npm install -g @anthropic/codex` 或从官方渠道安装
   - 验证：`codex --version`

2. **API Key 配置**
   - 在 `.env` 中确保 `ANTHROPIC_API_KEY` 已正确配置
   - CodexAdapter 会读取 `ANTHROPIC_API_KEY` 环境变量

3. **端到端验证**
   - 创建单聊，选择 Codex Agent
   - 发送简单 prompt："写一个 hello world"
   - 验证 `CodexAdapter.prepare()` 不再抛出 ENOENT
   - 验证 Agent 正常回复、文件操作正常
   - 验证 Diff 展示、Artifact 内联展示

4. **降级逻辑验证**
   - 故意让 codex 不可用，确认自动降级到 ClaudeCodeAdapter
   - 检查日志输出 `CodexAdapter prepare failed...falling back to ClaudeCodeAdapter`

### 涉及文件
- `apps/server/src/adapters/codex.adapter.ts` — 已实现，无需修改
- `apps/server/src/services/agent-runtime.service.ts` — 降级逻辑已就位

---

## 二、Bug：PPT 修改后预览缺失

**现象**：用户说"加一页"，Agent 修改 .pptx 后没有重新展示预览卡片。

### 根因分析（待确认）

可能原因：
1. `.pptx` 文件修改后，服务端 `diffSnapshots()` 没有重新触发 artifact 创建
2. artifact 去重逻辑（`seenNames`）把修改后的 PPT 误判为已展示
3. PPTX Artifact 创建后前端 `runArtifacts` 缓存未刷新

### 排查步骤

1. **检查日志** — 查看 `data/crash.log`，搜索 "PPTX" 相关 artifact 创建日志
2. **检查 WorkpaceService.diffSnapshots()** — 确认 `.pptx` 文件变更类型（modify）是否触发 artifact pipeline
3. **检查 ArtifactService.createArtifact()** — 确认 .pptx 的 `changeType !== "delete"` 不会跳过
4. **检查前端 artifact WS 事件** — 确认 `artifact:created` 广播后前端是否正确接收

### 修复方案（预期）

如果问题是 artifact 去重导致：
- `ChatArea.tsx` 中 `seenNames` 去重逻辑改为按 `runId + name` 去重，而非全局 `name` 去重
- 同一文件被不同 run 修改时，每个 run 都应有自己的 artifact

### 涉及文件
- `apps/server/src/services/agent-runtime.service.ts` — artifact 创建 pipeline
- `apps/web/src/components/chat/ChatArea.tsx` — artifact 去重逻辑
- `apps/server/src/services/workspace.service.ts` — diffSnapshots

---

## 三、Bug：自建 Agent 数据丢失

**现象**：刷新页面后，自建 Agent 的对话历史消失，Agent 管理中也找不到该 Agent。

### 根因分析（待确认）

可能原因：
1. **DB 持久化** — Agent 创建时未正确写入数据库（SQLite），或写入后未提交
2. **前端加载逻辑** — `listAgents()` 没有加载自建 Agent，只返回了默认 Agent
3. **Conversation → Agent 关联断裂** — conversation 表中 agentId 引用失败

### 排查步骤

1. **检查 SQLite 数据库**
   - 查看 `data/agenthub.db` 中 `agents` 表内容
   - 确认自建 Agent 记录是否存在
   - 检查 `conversations` 表对应的 agentId

2. **检查 Agent API**
   - `GET /api/agents` — 确认返回列表包含自建 Agent
   - `POST /api/agents` — 确认创建接口写入 DB

3. **检查前端 Agent Store**
   - `agent.store.ts` — `load()` 逻辑是否正确拉取
   - `ConversationList.tsx` — 创建对话时 agentId 映射是否正确

### 修复方案（预期）

如果问题是 DB 未持久化：
- 检查 `agent.service.ts` 的 `createAgent()` 是否调用了 `db.insert().run()`
- 检查事务提交逻辑

如果问题是前端未加载：
- `agent.store.ts` 在应用初始化时调用 `loadAgents()`
- `ConversationList` 新建对话时关联正确的 agentId

### 涉及文件
- `apps/server/src/services/agent.service.ts` — Agent CRUD
- `apps/server/src/routes/agents.ts` — Agent API 端点
- `apps/web/src/stores/agent.store.ts` — 前端 Agent 状态
- `apps/web/src/components/agent/AgentManagePanel.tsx` — Agent 管理面板
- `apps/web/src/components/chat/ConversationList.tsx` — 对话创建

---

## 四、验证方案

### 4.1 Codex CLI
| 步骤 | 预期 |
|---|---|
| 安装 CLI | `codex --version` 成功 |
| 创建 Codex 对话 | 不再降级，正常回复 |
| 文件操作 | Diff + Artifact 正常展示 |

### 4.2 PPT 修改预览
| 步骤 | 预期 |
|---|---|
| 生成 5 页 PPT | 预览卡片出现 |
| 说"加一页" | Agent 修改文件后，新的预览卡片出现 |
| 检查 artifact 列表 | 有 2 个 artifact（原版 + 修改版） |

### 4.3 Agent 数据持久化
| 步骤 | 预期 |
|---|---|
| 创建自建 Agent | Agent 管理面板中出现 |
| 创建该 Agent 的对话 | 对话正常 |
| 刷新页面 | 对话历史还在，Agent 管理中仍有该 Agent |
| 重启服务 | 同上 |

---

## 执行顺序建议

```
1. Codex CLI 安装（最独立，先做）
2. Agent 数据丢失（核心功能，影响体验）
3. PPT 修改预览（边缘 case，最后）
```
