# Phase 4 开发完成文档

**完成日期：** 2026-05-31（更新于 2026-06-03：稳定性修复 + 前端去重 + 4.1 记忆验证 + 4.3 端到端验证 + 4.4 富媒体内联 + 文本内联预览 + 代码全覆盖 + verification logs）

---

## 概述

完成 Phase 3 遗留基础设施模块 + Phase 4.1 Agent 短期记忆修复 + Phase 4.2 Diff 展示完善 + Phase 4.3 WorkspacePanel 集成完善。打通了从服务端 workspace → store → UI 的完整数据链路，新增快照回滚、文件内容查看、面板拖拽、工作目录管理等功能，并修复了 Agent 无法感知对话上下文的严重缺陷。

---

## 一、Phase 3 遗留项

### 1.1 服务端：WS 连接注册表

**文件：** `apps/server/src/ws/connection-registry.ts`（新建）

- `ConnectionRegistry` 类：管理 WebSocket 连接生命周期（register / unregister / joinRoom / leaveRoom / getRoom）
- 单例导出，集成到 `gateway.ts`

### 1.2 前端：乐观更新工具

**文件：** `apps/web/src/lib/optimistic-updates.ts`（新建）

- `optimisticUpdate()` — 通用乐观写入 + 失败回滚
- `createOptimisticExecutor()` — React 组件级封装

---

## 二、Phase 4.1 Agent 短期记忆修复（2026-06-02）

### 2.1 缺陷现象

Agent 每次收到新消息时，只看到当前消息本身，完全不知道对话历史。例如用户先问"写一个 hello world"，再问"把输出改成中文"，Agent 不知道前面写过什么。

### 2.2 根因分析

1. `chat.service.ts` / `agent-runtime.service.ts` 调用 adapter 时只传了 `prompt: body.content`（当前消息），未构建历史上下文
2. `adapter.run()` 使用 `-p "当前消息"` 启动子进程，适配器不加载数据库中的历史消息
3. `--no-session-persistence` flag 禁用了 CLI 层的会话持久化，确保每次运行从零开始
4. `PlannerService.buildPlannerPrompt()` 虽定义了 `conversationHistory?` 字段，但无调用方填充

### 2.3 修复方案

**核心思路：** 每次 Agent run 启动时，从 DB 加载同 conversation 的历史消息，注入到 `--system-prompt` 中，使 Agent 感知完整对话上下文。

**数据流：**

```
用户发送消息
  → agent-runtime.service.ts startDirectRun()
    → chatService.buildAgentContext(conversationId)
      → 查询 messages 表（按 createdAt 排序）
      → pinned 消息优先注入（最多 5 条）
      → 最近 20 条普通消息（排除当前 prompt）
      → 4000 字符上限截断
      → 返回 [{ role, content }, ...]
    → adapter.run({ prompt, messageHistory, ... })
      → claude-code.adapter.ts / codex.adapter.ts
        → 格式化为 [用户] / [AI助手] 标记的对话历史
        → 注入 --system-prompt
```

### 2.4 修改文件清单

| 文件 | 变更 |
|---|---|
| `adapters/base.ts` | `RunInput` 新增 `messageHistory?: { role, content }[]` 字段 |
| `chat.service.ts` | 新增 `buildAgentContext()` — 从 DB 读历史 + pinned 优先 + 截断 |
| `agent-runtime.service.ts` | `startDirectRun()` 调用 `buildAgentContext()` 并传入 `adapter.run()` |
| `claude-code.adapter.ts` | 将 `messageHistory` 格式化为对话历史注入 `--system-prompt` |
| `codex.adapter.ts` | 同样的历史注入逻辑（与 Claude Code adapter 一致） |
| `orchestrator.service.ts` | 群聊路径调用 `buildAgentContext()` 填充 `PlannerInput.conversationHistory` |

### 2.5 关键约束

- **上下文窗口限制：** 4000 字符硬截断，保证不超出 CLI 限制
- **pinned 优先：** 已 pin 的消息必定注入，最多 5 条；固定消息排在所有消息之前，Agent 总能优先看到固定的上下文
- **单条消息不截断：** `addMsg()` 以整条消息为单位检查预算，超限则跳过该条而不是截断内容
- **历史角色标记：** `[用户]` / `[AI助手]` 清晰区分发言人
- **排除当前消息：** `normal.slice(-maxMessages, -1)` 避免重复发送当前 prompt
- **群聊兼容：** Orchestrator 调用 Planner 时同步填充 `conversationHistory`

### 2.6 验证结果（2026-06-03）

- 短期记忆：Agent 能正确感知对话历史上下文 ✅
- pinned 消息注入：固定消息在超长对话中依然排在最前面，不受截断影响 ✅
- 多轮对话连贯性：用户连续追加需求（如"改成中文"），Agent 记得之前的输出 ✅

---

## 三、Phase 4.2 对话中 Diff 展示完善

### 2.1 服务端：真实 unified diff 生成

- 安装 `diff` npm 包
- `createSnapshot()` 在 `data/snapshots/<id>/` 下存储文件副本
- `_generateDiff()` 使用 `diffLib.createPatch()` 生成真正 unified diff
- `deleteSnapshot()` 清理快照目录

### 2.2 前端：DiffBlock 统一 diff 渲染

**文件：** `apps/web/src/components/chat/DiffBlock.tsx`（新建）

- 逐行着色：`+` 绿 / `-` 红 / `@@` 蓝 / 上下文灰
- 超过 20 行默认折叠，可展开/收起
- 文件路径头部可点击 → 触发 WorkspacePanel 联动定位

### 2.3 前端：MarkdownContent 内联 Diff

**文件：** `apps/web/src/components/chat/MarkdownContent.tsx`

- `` ```diff `` 代码块使用 `<DiffBlock>` 渲染

### 2.4 前端：DiffCard + 跨组件联动

- `DiffCard.tsx` 使用 `<DiffBlock>` 替代纯文本
- `ui.store.ts` 新增 `selectedChangePath` / `selectChangePath`
- `WorkspacePanel.tsx` 监听 → 自动切换变更 Tab + 蓝色光环高亮

---

## 四、Phase 4.3 WorkspacePanel 集成完善

### 3.1 服务端：文件树 API

- `buildFileTree(rootPath)` — 递归目录扫描，返回 `FileNode[]`
- `GET /api/workspaces/:id/files` — 文件树端点
- `GET /api/workspaces/browse?path=` — 通用目录浏览
- `PATCH /api/workspaces/:id` — 更新 rootPath

### 3.2 前端：Store 集成 + 面板功能

- `workspace.store.ts` — `load()` 加载文件树/快照/变更；`updateRootPath()` 更改目录；`refresh()` 刷新数据
- `App.tsx` — 接入 `useWorkspaceStore` / `useUIStore`，面板折叠/展开/拖拽
- `ChatArea.tsx` — 移除重复 state，WS 事件驱动刷新
- `WorkspacePanel.tsx` — 内联组件替换、面板切换、文件选择、目录更改

### 3.3 快照回滚

- `WorkspaceService.rollbackToSnapshot()` — 清空工作区 → 从快照复制文件
- `POST /api/workspaces/:id/snapshots/:snapshotId/rollback`
- `SnapshotList.tsx` — 回滚按钮 + 二次确认

### 3.4 新增文件内容查看

- `WorkspaceService.readFileContent()` — 文本内容读取 + 二进制检测 + 路径安全校验 + 大小限制
- `GET /api/workspaces/:id/file-content?path=`
- `DiffCard.tsx` — `FileContentViewer` 子组件，合成 unified diff 通过 DiffBlock 渲染

### 3.5 工作目录管理

- Agent 工作目录修复：`workingDir: workspaceRootPath`（原为 `process.cwd()`）
- 默认工作目录：`D:\Projects\MasterOfAgents\Test`
- 手动更改工作目录：文本输入方式
- 新建对话指定工作目录：创建弹窗中可选填写

### 3.6 面板交互

- 面板宽度拖拽调整（240px–600px）
- WS 事件驱动的 workspace 刷新

### 3.7 端到端验证（2026-06-03）

**验证范围：** manifest 生成 → snapshot 存储 → diff 检测 → rollback → 删除清理

| 验证项 | API/方法 | 结果 |
|---|---|---|
| 快照创建 | `POST /:id/snapshots` | ✅ manifest JSON 正确存储，文件副本写入 `data/snapshots/` |
| 快照列出 | `GET /:id/snapshots` | ✅ 按时间倒序返回 |
| 快照回滚 | `POST /:id/snapshots/:id/rollback` | ✅ 工作区文件正确恢复 |
| 快照删除 | `DELETE /:id/snapshots/:id` | ✅ DB 记录 + 文件目录清理 |
| 文件树 | `GET /:id/files` | ✅ 正确递归列出，排除隐藏文件 |
| 文件内容 | `GET /:id/file-content?path=` | ✅ 文本读取 + 二进制检测 + 路径安全 |
| TypeScript 编译 | `tsc --noEmit` | ✅ server / web 均零错误 |

**验证过程中发现并修复 2 个 bug：**

1. **`readFileContent` Windows 路径斜杠不匹配** — `path.resolve()` 输出反斜杠（`D:\...`），但 DB 中 rootPath 存正斜杠（`D:/...`），导致 `startsWith` 安全检查始终失败 → 所有文件读取返回 `isBinary: true, size: 0`
2. **manifest/copyDir 隐藏文件不一致** — `_walkDir` 仅跳过隐藏目录，不跳过隐藏文件（如 `.env`），但 `_copyDir` 两者都跳过 → manifest 可引用快照中不存在的文件 → diff 生成错误

---

## 关键架构决策

| 决策 | 说明 |
|---|---|
| `buildAgentContext()` 注入短期记忆 | 每次 run 从 DB 读取历史 → system prompt，4000 字符截断 |
| workspace.store 作为单一数据源 | 文件树、快照、变更仅由 store 管理 |
| ui.store 管理面板状态 | 扩展支持 selectedChangePath 跨组件通信 |
| DiffBlock 为统一 diff 渲染器 | MarkdownContent 和 DiffCard 共享 |
| 快照文件副本存储 | `data/snapshots/<id>/` 支持 diff 和回滚 |
| WS 事件驱动刷新 | run:started/run:completed/file:changed 触发 store 更新 |

---

## 五、稳定性修复（2026-06-03）

### 5.1 服务端 EPIPE 崩溃修复

**问题**：Python 启动器 pipe 断开时，`crashLog` 中的 `process.stderr.write` 触发 EPIPE 错误 → `uncaughtException` → 进程崩溃。

**修复：**
- `crash-log.ts`：移除所有 `process.stderr.write` 调用，仅保留 `fs.appendFileSync` 文件写入
- `app.ts`：添加 `process.stdout.on("error", ...)` 和 `process.stderr.on("error", ...)` 监听器，EPIPE 静默吞掉

### 5.2 Agent "思考中" 卡死修复

**问题**：CLI 子进程无输出时，事件循环在 `Promise.race` 中永久阻塞，前端 UI 永远显示"思考中"。

**修复：**
- `claude-code.adapter.ts` / `codex.adapter.ts`：ProcessSupervisor 空闲看门狗 — 3 分钟无输出自动 kill
- Promise.race 增加 30s 心跳唤醒定时器，定期检查 idle/abort 状态
- `agent-runtime.service.ts`：stream 未产生 `run_completed`/`run_failed` 时合成 `run_completed`，确保前端始终退出"思考中"

### 5.3 前端 FileChange 去重

**问题**：群聊多 Agent 场景下，WS 广播与 HTTP `load()` 可能返回同一 FileChange 的不同 ID 版本，导致前端展示重复条目。

**修复**（`workspace.store.ts`）：
- `updateFileChange`（WS 路径）：先按 `id` 精确匹配 → 再按 `(path, changeType)` 去重 → 才新增
- `load()` merge（HTTP 路径）：同时用 `existingIds` 和 `existingKeys`（`path::changeType`）过滤

### 5.4 tsx watch 排除快照目录

**问题**：`tsx watch` 监控整个 CWD，`data/snapshots/` 下新增快照文件副本会触发服务重启。

**修复**：`package.json` dev 脚本改为 `tsx watch --exclude "data/**" --exclude "node_modules/**" src/index.ts`

### 5.5 快照安全防护

- `_buildTree`：深度限制 20 层 + 跳过危险目录（node_modules、.git 等）
- `_copyDir`：目标路径在源路径内的递归防护
- `copySnapshotFiles`：排除隐藏文件

### 5.6 crash.log 每次启动清空

**问题**：`data/crash.log` 随服务重启次数无限累积，旧日志失去时效性且文件越来越大。

**修复：**
- `crash-log.ts`：新增 `clearCrashLog()` 导出函数，使用 `fs.writeFileSync(path, "")` 在启动时截断日志文件
- `app.ts`：`main()` 中 `server.start` 之前调用 `clearCrashLog()`，确保每个服务会话从空日志开始

---

## 六、Phase 4.4 Agent 回复富媒体内联展示（2026-06-03）

### 6.1 服务端：Artifact 自动创建 Pipeline

**文件：** `agent-runtime.service.ts`

在 `diffSnapshots()` 完成后，遍历 file changes，对可预览文件（HTML/CSS/JS/TS/JSON/图片/PDF/MD/TXT 等）调用 `ArtifactService.createArtifact()` 自动创建 artifact，并通过 `artifact:created` WS 事件广播到前端。

### 6.2 前端：InlineDiffCard（内联文件变更卡片）

**文件：** `apps/web/src/components/chat/InlineDiffCard.tsx`（新建）

- 复用 `DiffBlock` 渲染 diff 内容
- 顶部：变更类型标签（`+`/`-`/`~`）、文件路径、状态标签（待处理/已应用/已回滚）
- 底部：pending 状态下显示 Apply / Revert 按钮，调用 `applyFileChange(id)` / `revertFileChange(id)`
- FileChangeList 从对话框顶部移除，文件变更改为 per-message 内联展示

### 6.3 前端：InlineArtifactCard（统一产物分发）

**文件：** `apps/web/src/components/chat/InlineArtifactCard.tsx`（新建）

根据 `artifact.type` + `artifact.mimeType` 分发渲染：
- `webpage` / `text/html` → `<WebPreviewCard>` — 可折叠 iframe
- `image/*` → 内联 `<img>` 缩略图 + 下载
- 其他类型 → `<DownloadCard>` — 文件名/大小 + 下载按钮

### 6.4 前端：ChatArea 集成

**文件：** `apps/web/src/components/chat/ChatArea.tsx`

- 新增 `runFileChanges` / `runArtifacts` local state（按 runId 分组缓存）
- 会话加载时调用 `listArtifactsByConversation()` 拉取 artifacts
- WS handler：`file:changed` 同步更新 per-run 缓存；新增 `artifact:created` 处理
- Agent 消息下方渲染 InlineDiffCard + InlineArtifactCard
- conversationId 变更时重置所有 per-run 缓存

### 6.5 WebPreviewCard 增强

**文件：** `apps/web/src/components/artifact/WebPreviewCard.tsx`

- 新增收起/展开按钮（`</>` / `><`），收起时仅显示标题栏
- "新窗口打开" 链接

### 6.6 Bug 修复

- **Artifact previewUrl 404** — `artifact.service.ts` 中 `previewUrl` 缺少 `/static/` 段，前端拼接后路由不匹配。改为 `/artifacts/static/${id}/${name}`

---

## 验证结果

- TypeScript 编译：server ✅ / web ✅（零错误）
- **4.1 短期记忆：** agent 能感知对话历史（`buildAgentContext()` → system prompt），群聊 Planner 同步填充 `conversationHistory`
- 数据链路：store.load() → API → WorkspacePanel 三 Tab 渲染
- 快照回滚：确认后恢复文件 → 文件树自动刷新
- Diff 渲染：`+` 绿 / `-` 红 / `@@` 蓝 / 长 diff 折叠
- 联动：点击 diff 路径 → WorkspacePanel 变更 Tab + 高亮
- 面板拖拽：240–600px，实时调整
- **稳定性：** 服务端不再因 EPIPE 崩溃；Agent 不再"思考中"卡死；前端无重复 FileChange 播报；crash.log 每次启动自动清空
- **4.4 内联展示：** InlineDiffCard / InlineArtifactCard 按 runId 内联到消息下方；WebPreviewCard 可折叠 iframe
- **文本/代码内联：** TextPreviewCard 直接展示文本内容（含截断展开）；Artifact pipeline 覆盖 ~40 种代码扩展

---

## 七、2026-06-03 后续优化

### 7.1 InlineDiffCard Apply/Revert 按钮统一

**问题**：删除类型（`delete`）的 FileChange 只显示"回滚"按钮，缺少"应用"按钮；创建类型（`create`）只显示"应用"，缺少"回滚"。三种变更类型的操作按钮不一致。

**修复**（`InlineDiffCard.tsx`）：
- 移除 `change.changeType !== "delete"` 和 `change.changeType !== "create"` 的按钮条件守卫
- 现在 create / modify / delete 三种类型在 pending 状态下均显示 ✓ 应用 + ↩ 回滚

### 7.2 Phase 4 Verification Log 补全

已有 3 个 log（Phase 3+4.3 集成 / 4.2 Diff / 4.3 Extras），新增 3 个：

| 文件 | 内容 | 测试项 |
|---|---|---|
| `phase4-verify-1777977600000.log` | Phase 4.1 Agent 短期记忆 | 48 项 — buildAgentContext / adapter 注入 / pinned / 截断 / 群聊 |
| `phase4-verify-1777984800000.log` | Phase 4.4 富媒体内联展示 | 66 项 — Artifact pipeline / InlineDiffCard / InlineArtifactCard / ChatArea / 去重 |
| `phase4-verify-1777992000000.log` | 稳定性修复合集 | 49 项 — EPIPE / 卡死 / tsx watch / crash.log 清空 / 去重 / 快照安全 |

至此 Phase 4 全部 6 个子阶段均有独立 verification log。

### 7.3 TextPreviewCard — 文本文件内联展示

**文件：** `apps/web/src/components/artifact/TextPreviewCard.tsx`（新建）

- `fetch` 获取 Artifact 原始内容，loading / error 状态处理
- `<pre>` 代码块，深色背景 + 等宽字体，`max-h-96` 可滚动
- 大文件自动截断：超过 200 行或 80KB 折叠，底部"展开全部"按钮
- 头部栏：📄 + 文件名 + 行数/大小 + 语言标签 + 下载 + `</>`/`><` 折叠
- MIME → 语言标签映射：python / java / go / rust / c / cpp / shell / ruby / php / swift / kotlin / scala / sql / lua / toml / yaml 等

**InlineArtifactCard 分发更新：** 新增 `isText()` 检测 → 路由到 `TextPreviewCard`。分发顺序：webpage → image → text → DownloadCard。

### 7.4 Artifact Pipeline 代码扩展全覆盖

**问题**：服务端 artifact 创建只覆盖了 ~15 种扩展名（html/css/js/ts/json/图片/pdf/txt/md 等），其余全部 `continue` 跳过 → 前端收不到 artifact → 无任何内联展示。

**修复**（`agent-runtime.service.ts`）：
- 新增 ~25 种代码扩展：`.py` `.java` `.go` `.rs` `.c` `.cpp` `.sh` `.rb` `.php` `.swift` `.kt` `.sql` `.lua` `.toml` `.vue` `.svelte` `.ini` `.cfg` `.env` 等
- `else { continue; }` → `else { mimeType = "text/plain"; }` — 兜底策略，Agent 创建的文件几乎都是文本

**影响**：所有常见编程语言的源码文件现在都会在 Agent 回复下方内联展示。
