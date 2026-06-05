# Phase 4 开发完成文档

**完成日期：** 2026-06-03
**状态：** 已完成

---

## 概述

Phase 4 完成四大模块：Agent 短期记忆修复、Diff 展示完善、WorkspacePanel 集成、富媒体内联展示。打通服务端 workspace → store → UI 完整链路，新增快照回滚、文件内容查看、面板拖拽、工作目录管理。

---

## 一、Agent 短期记忆（Phase 4.1）

**修复**：Agent 每次 run 启动时，从 DB 加载同 conversation 的历史消息，注入 `--system-prompt`，使 Agent 感知完整对话上下文。

### 数据流

```
startDirectRun()
  → chatService.buildAgentContext(conversationId)
    → pinned 消息优先（最多 5 条）
    → 最近 20 条普通消息（排除当前 prompt）
    → 4000 字符硬截断（整条消息为单位）
  → adapter.run({ messageHistory })
    → 格式化为 [用户] / [AI助手] 标记注入 system prompt
```

### 修改文件

| 文件 | 变更 |
|---|---|
| `adapters/base.ts` | `RunInput` 新增 `messageHistory` 字段 |
| `chat.service.ts` | 新增 `buildAgentContext()` |
| `agent-runtime.service.ts` | startDirectRun 调用 buildAgentContext 并传入 adapter |
| `claude-code.adapter.ts` | 历史注入 `--system-prompt` |
| `codex.adapter.ts` | 同上 |
| `orchestrator.service.ts` | 群聊路径填充 `conversationHistory` |

---

## 二、Diff 展示完善（Phase 4.2）

### 服务端
- `diff` npm 包生成 unified diff：`diffLib.createPatch()`
- `createSnapshot()` 在 `data/snapshots/<id>/` 存储文件副本支持 diff
- `deleteSnapshot()` 清理快照目录

### 前端
- `DiffBlock.tsx` — 统一 diff 渲染器：`+` 绿 / `-` 红 / `@@` 蓝，>20 行折叠
- `MarkdownContent.tsx` — `` ```diff `` 代码块使用 DiffBlock 渲染
- `DiffCard.tsx` — 使用 DiffBlock 替代纯文本
- 跨组件联动：点击 diff 路径 → WorkspacePanel 自动切换变更 Tab + 蓝色高亮

---

## 三、WorkspacePanel 集成（Phase 4.3）

### 服务端
- `buildFileTree(rootPath)` — 递归目录扫描，返回 `FileNode[]`
- `GET /api/workspaces/:id/files` — 文件树端点
- `GET /api/workspaces/browse?path=` — 通用目录浏览
- `GET /api/workspaces/:id/file-content?path=` — 文本内容读取（二进制检测 + 路径安全）
- `PATCH /api/workspaces/:id` — 更新 rootPath
- `POST /api/workspaces/:id/snapshots/:snapshotId/rollback` — 快照回滚

### 前端
- `workspace.store.ts` — load / updateRootPath / refresh
- `App.tsx` — useWorkspaceStore / useUIStore，面板折叠/展开
- `ChatArea.tsx` — WS 事件驱动刷新，移除重复 state
- `SnapshotList.tsx` — 回滚按钮 + 二次确认
- `DiffCard.tsx` — FileContentViewer（合成 unified diff → DiffBlock 渲染）
- 面板宽度拖拽调整（240px–600px）

### 工作目录管理
- Agent workingDir 修复：`workingDir: workspaceRootPath`（原为 `process.cwd()`）
- 默认工作目录：`Test/`，支持手动更改 + 新建对话指定

---

## 四、富媒体内联展示（Phase 4.4）

### 服务端：Artifact 自动创建 Pipeline
diffSnapshots() 完成后遍历 file changes → 对可预览文件（~40 种扩展）调用 `ArtifactService.createArtifact()` → `artifact:created` WS 广播。

### 前端

| 组件 | 说明 |
|---|---|
| `InlineDiffCard` | 文件变更内联卡片（DiffBlock + Apply/Revert 按钮），per-message 展示 |
| `InlineArtifactCard` | 统一产物分发：webpage → WebPreviewCard、image → `<img>`、text → TextPreviewCard、其他 → DownloadCard |
| `TextPreviewCard` | 文本内容内联（fetch + `<pre>` 代码块，>200 行/80KB 截断展开） |
| `WebPreviewCard` | 可折叠 iframe + "新窗口打开" |

### ChatArea 集成
- `runFileChanges` / `runArtifacts` local state（按 runId 分组）
- 会话加载时 `listArtifactsByConversation()` 拉取 artifacts
- WS 事件实时更新 per-run 缓存
- Agent 消息下方按 runId 渲染 InlineDiffCard + InlineArtifactCard

---

## 五、稳定性修复（2026-06-03）

| 修复项 | 说明 |
|---|---|
| EPIPE 崩溃 | `crash-log.ts` 移除 `process.stderr.write`，仅保留 `fs.appendFileSync`；`app.ts` 监听 stdout/stderr error |
| Agent "思考中" 卡死 | 空闲看门狗 3 分钟无输出 → kill；Promise.race 30s 心跳唤醒；合成 `run_completed` 兜底 |
| FileChange 去重 | `workspace.store.ts`：WS 按 (path, changeType) 去重；HTTP 用 existingIds + existingKeys 过滤 |
| tsx watch 重启 | dev 脚本排除 `data/**` 和 `node_modules/**` |
| crash.log 累积 | `clearCrashLog()` → 每次启动截断 |
| 快照安全 | 深度限制 20 层、跳过危险目录、copyDir 递归防护、排除隐藏文件 |

---

## 关键架构决策

| 决策 | 说明 |
|---|---|
| `buildAgentContext()` 注入短期记忆 | DB 历史 → system prompt，4000 字符截断，pinned 优先 |
| workspace.store 单一数据源 | 文件树/快照/变更统一管理 |
| DiffBlock 统一渲染器 | MarkdownContent 和 DiffCard 共享 |
| 快照文件副本存储 | `data/snapshots/<id>/` 支持 diff 和回滚 |
| Artifact 扩展名全量覆盖 | ~40 种代码扩展 + text/plain 兜底 |
| WS 事件驱动刷新 | run:started/run:completed/file:changed 触发 store 更新 |

---

## 验证结果

| 验证项 | 状态 |
|---|---|
| TypeScript 编译（server / web） | ✅ |
| Agent 短期记忆（多轮对话连贯性） | ✅ |
| pinned 消息优先注入 + 截断不受影响 | ✅ |
| 群聊 Planner 同步填充 conversationHistory | ✅ |
| Diff 渲染（+绿/-红/@@蓝/折叠） | ✅ |
| 快照回滚 + 文件树自动刷新 | ✅ |
| 跨组件联动（diff 路径 → WorkspacePanel） | ✅ |
| 面板拖拽 240–600px | ✅ |
| 服务端 EPIPE / 卡死修复 | ✅ |
| FileChange / Artifact 去重 | ✅ |
| InlineDiffCard / InlineArtifactCard 内联展示 | ✅ |
| ~40 种代码扩展 artifact 覆盖 | ✅ |
| WebPreviewCard 折叠展开 | ✅ |

---

## 下一步：Phase 5

Agent 体验与稳定性已达标，Phase 5 将集成 PPT 生成能力。工作项：
1. PPT 生成双路径 — pptxgenjs（秒级程序化）+ Gemini AI（视觉丰富）
2. PPTX 预览 — PptxViewerCard（pptxviewjs Canvas 渲染）+ ImageSlideshowCard（轮播）
3. Agent 行为约束 — 正面约束指令，阻止生成后自我审查
4. Artifact Pipeline 增强 — slideshow 类型、shouldSkipFile 过滤、PPTX→HTML 自动转换
5. 浅色/深色主题 — PR #1 合并，25+ 组件 dark: 适配
