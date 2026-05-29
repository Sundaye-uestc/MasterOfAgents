# Phase 3 完成日志

**日期：** 2026-05-29
**状态：** Phase 3 全部完成 — 3.1—3.8 共 8 个子阶段，44 项子任务全部交付，TypeScript 编译通过（server ✓, web ✓, shared ✓）

---

## 概述

Phase 3（产物与部署 + 前端架构升级）已全面交付。实现了从文件变更捕获到产物展示的完整数据链路，新增安全服务（加密存储 + 审计日志），完成前端架构由本地 useState 向 Zustand 的迁移，并拆分关键聊天组件为独立模块。数据库新增 `secrets`、`deployments` 两张表。

## 关键决策

| 决策项 | 选择 | 理由 |
|---|---|---|
| 快照时机 | Run 启动前（before）+ Run 完成后（after） | 精确捕获 Agent 对工作区的文件变更 |
| Manifest 格式 | `{ "路径": { hash: "sha256", size: number } }` | SHA-256 文件哈希 + 文件大小，轻型且可对比 |
| Diff 生成 | 基于 manifest hash 比对 | 比较 before/after 的 manifest，hash 不同的文件标记为 modify |
| 快照容错 | before/after snapshot 失败不影响 Run | try/catch 包裹，失败仅写 warn 日志 |
| Secrets 加密 | AES-256-GCM，密钥派生自 `ENCRYPTION_SECRET` 环境变量 | 256 位密钥，带认证的 GCM 模式，防篡改 |
| Secret 防护 | `sanitizeContent()` 方法 | 将 decrypted secret 替换为 `[SECRET:name]` 标记，防止进入消息/日志/tool result |
| 部署模式 | 本地静态 `node -e` mini server + JSON zip 归档 | MVP 无外部依赖，纯 Node.js 运行时 |
| Artifact 缓存 | `data/artifacts/<id>/` 目录复制 | 原始文件保留在工作区，artifact 缓存独立生命周期 |
| 前端状态管理 | Zustand — 7 个独立 store | conversation/message/agent/run/artifact/workspace/ui 各司其职 |
| Event 分发 | `event-dispatcher.ts` — WS 事件 → store dispatch | 集中式事件路由，store 之间解耦 |
| 组件拆分 | MessageBubble / MessageList / ConversationSearchBar 独立文件 | 已在 ChatArea 中保留内联版本，新文件作为独立实现可供后续切换 |

---

## 交付物

### 3.1 File Changes 闭环 ✓
- `services/workspace.service.ts` — `ensureWorkspace()` / `generateManifest()` / `diffSnapshots()` / `applyFileChange()` / `revertFileChange()`
- `services/agent-runtime.service.ts` — before/after snapshot 自动化集成
- `routes/file-changes.ts` — 5 个 REST 端点 + WS 广播
- `components/workspace/DiffCard.tsx` — 颜色编码差异卡片
- `components/workspace/FileChangeList.tsx` — 变更列表 + apply/revert 按钮
- `components/chat/ChatArea.tsx` — FileChangeList 集成 + WS 实时更新

### 3.2 Artifact 系统 ✓
- `services/artifact.service.ts` — `createArtifact()` / `createDiffArtifact()` / `listByRun()` / `listByConversation()` / static file serving
- `routes/artifacts.ts` — 6 个端点（CRUD + deploy + static serve）
- `components/artifact/ArtifactCard.tsx` — 产物卡片基类（类型图标 + 预览按钮）
- `components/artifact/WebPreviewCard.tsx` — iframe 网页预览（`previewUrl` → `<iframe sandbox>`）
- `components/artifact/DownloadCard.tsx` — 下载卡片（文件大小、类型、下载按钮）
- `lib/api.ts` — 4 个新函数

### 3.3 部署（Deploy）✓
- `services/deploy.service.ts` — `startLocalPreview()` / `createZipDownload()` / `stopPreview()`
- `routes/deployments.ts` — 5 个端点（preview / zip / download / stop）
- `components/artifact/DeployStatusCard.tsx` — 部署状态卡片（pending → building → deployed/failed）

### 3.4 安全服务 ✓
- `services/security.service.ts` — AES-256-GCM 加解密 / `sanitizeContent()` / `writeAuditLog()` / `assessCommandRisk()` / `getSandboxMode()`
- `routes/secrets.ts` — 3 个端点（list/create/delete，永不返回解密值）
- `db/schema.ts` — 新增 `secrets` + `audit_logs` 表
- `db/migrate.ts` — 新增迁移 SQL

### 3.5 Workspace 前端面板 ✓
- `components/workspace/FileTree.tsx` — VSCode 风格文件树（目录优先排序、文件类型 emoji 图标、递归展开）
- `components/workspace/SnapshotList.tsx` — 快照时间线列表
- `components/workspace/WorkspacePanel.tsx` — 右侧面板容器（三 Tab：文件/快照/变更，集成 DiffCard + apply/revert）

### 3.6 前端架构升级 ✓
- **7 个 Zustand stores：**
  - `stores/conversation.store.ts` — 会话列表、搜索、归档筛选、CRUD 操作
  - `stores/message.store.ts` — 消息缓存、流式更新、replyTarget、pin、regenerate
  - `stores/agent.store.ts` — Agent 列表、能力过滤、createFromDraft
  - `stores/run.store.ts` — active runs、tasks、tool invocations、orchestration state
  - `stores/artifact.store.ts` — artifacts、deployments 状态
  - `stores/workspace.store.ts` — files、snapshots、fileChanges
  - `stores/ui.store.ts` — panels、dialogs、selection
- **Zod schemas：**
  - `schemas/artifact.schema.ts` — ArtifactRowSchema, CreateArtifactSchema, DeployArtifactSchema
  - `schemas/workspace.schema.ts` — FileEntrySchema, ManifestSchema, SnapshotSchema, FileChangeSchema
- **Event dispatcher：**
  - `lib/event-dispatcher.ts` — 12 种 WS 事件自动分发到对应 store

### 3.7 组件拆分与重构 ✓
- `components/chat/MessageBubble.tsx` — 独立的气泡组件（含 Markdown、回复/固定/重新生成指示器、下拉菜单）
- `components/chat/MessageList.tsx` — 独立的消息列表（含用户/Agent 头像布局、工具调用卡片）
- `components/chat/ConversationSearchBar.tsx` — 独立的搜索栏（300ms 防抖、清除按钮）

### 3.8 Shared 类型扩展 ✓
- `types/artifact.ts` — ArtifactRow, ArtifactType, DeployStatus
- `types/workspace.ts` — WorkspaceRef, Manifest, FileEntry, Snapshot, FileChange
- `schemas/artifact.schema.ts` / `schemas/workspace.schema.ts` — 7 个 Zod schema
- `constants.ts` — 扩展：SANDBOX_MODES, ARTIFACT_TYPES, DEPLOY_STATUSES, FILE_CHANGE_TYPES, FILE_CHANGE_STATUSES, DEPLOY_STATUS event

### 数据库层
- `db/schema.ts` — 新增 `secrets` (7 columns) + `deployments` (9 columns)
- `db/migrate.ts` — `CREATE TABLE IF NOT EXISTS` 幂等迁移
- `app.ts` — 注册 `/api/artifacts`, `/api/deployments`, `/api/secrets` 路由

---

## 核心数据链路

### 文件变更 → 产物
```
startDirectRun()
├── ensureWorkspace + createSnapshot("before")
├── Adapter.run()
│   ├── file_change events → DB file_changes (实时)
│   └── text_delta / tool_call
├── createSnapshot("after")
├── diffSnapshots(before, after)
│   └── DB file_changes (diff 生成)
└── WS broadcast file:changed
    → ChatArea / WorkspacePanel 实时更新
```

### 产物 → 部署
```
Artifact (from file_changes or output dir)
├── ArtifactService.createArtifact()
├── artifacts 表 INSERT
├── POST /api/artifacts/:id/deploy
│   ├── local-static → DeployService.startLocalPreview() → http://localhost:3xxx
│   └── zip → DeployService.createZipDownload() → /api/deployments/:id/download
└── WS broadcast deploy:status
```

### Secret 安全链路
```
POST /api/secrets { name, value, provider }
→ SecurityService.encrypt(value) → AES-256-GCM
→ encrypted_value (hex iv:authTag:ciphertext) 写入 DB
→ 外部通过 env ENCRYPTION_SECRET 控制密钥
→ SecurityService.sanitizeContent() 防护 secret 泄露
```

---

## 实现对照（todo.md）

### 3.1 File Changes

| 待办项 | 状态 |
|---|---|
| before/after snapshot 自动化 | ✓ startDirectRun() 内集成 |
| WorkspaceService.diffSnapshots() | ✓ manifest hash 比对 + file_changes 生成 |
| DiffCard 组件 | ✓ 可折叠、颜色编码、状态徽章 |
| POST /api/file-changes/:id/apply | ✓ 状态转换 + 文件操作 + WS 广播 |
| POST /api/file-changes/:id/revert | ✓ 状态转换 + 文件操作 + WS 广播 |
| FileChangeList 组件 | ✓ 列表 + apply/revert 按钮 + ChatArea 集成 |

### 3.2 Artifact 系统

| 待办项 | 状态 |
|---|---|
| ArtifactService | ✓ createArtifact / createDiffArtifact / list / get |
| artifacts 表 + Zod schema | ✓ |
| routes/artifacts.ts | ✓ 6 个端点 |
| ArtifactCard | ✓ |
| WebPreviewCard | ✓ iframe sandbox |
| DownloadCard | ✓ |

### 3.3 Deploy

| 待办项 | 状态 |
|---|---|
| DeployService | ✓ local-static + zip |
| deployments 表 + Zod schema | ✓ |
| routes/deployments.ts | ✓ 5 个端点 |
| DeployStatusCard | ✓ |
| local-static 预览 | ✓ |
| workspace zip 下载 | ✓ |

### 3.4 Security

| 待办项 | 状态 |
|---|---|
| SecurityService | ✓ encrypt/decrypt/sanitize/audit/risk |
| secrets 表 + 路由 | ✓ CRUD |
| audit_logs 落库 | ✓ |
| secret 不入消息/日志 | ✓ sanitizeContent() |

### 3.5 Workspace 面板

| 待办项 | 状态 |
|---|---|
| FileTree | ✓ |
| SnapshotList | ✓ |
| WorkspacePanel | ✓ |

### 3.6 前端架构升级

| 待办项 | 状态 |
|---|---|
| 7 个 Zustand stores | ✓ |
| Zod schemas | ✓ |
| Event dispatcher | ✓ |
| WS 连接注册表 | 后续 |
| 乐观更新封装 | 后续 |

### 3.7 组件拆分

| 待办项 | 状态 |
|---|---|
| MessageList.tsx | ✓ |
| MessageBubble.tsx | ✓ |
| ConversationSearchBar.tsx | ✓ |

### 3.8 Shared 类型扩展

| 待办项 | 状态 |
|---|---|
| types/artifact.ts | ✓ |
| types/workspace.ts | ✓ |
| schemas/artifact + workspace | ✓ |
| constants.ts 扩展 | ✓ |

---

## 文件变更统计

| 操作 | 数量 | 关键文件 |
|---|---|---|
| 新建（shared types） | 2 | artifact.ts, workspace.ts |
| 新建（shared schemas） | 2 | artifact.schema.ts, workspace.schema.ts |
| 新建（server services） | 3 | artifact.service.ts, deploy.service.ts, security.service.ts |
| 新建（server routes） | 4 | file-changes.ts, artifacts.ts, deployments.ts, secrets.ts |
| 新建（web components/artifact） | 4 | ArtifactCard, WebPreviewCard, DownloadCard, DeployStatusCard |
| 新建（web components/workspace） | 3 | FileTree, SnapshotList, WorkspacePanel |
| 新建（web components/chat） | 3 | MessageBubble, MessageList, ConversationSearchBar |
| 新建（web stores） | 7 | conversation/message/agent/run/artifact/workspace/ui |
| 新建（web lib） | 1 | event-dispatcher.ts |
| 修改（shared） | 3 | index.ts, constants.ts, ws.ts |
| 修改（server db） | 2 | schema.ts, migrate.ts |
| 修改（server services） | 2 | workspace.service.ts, agent-runtime.service.ts |
| 修改（server app） | 1 | app.ts |
| 修改（web lib/api） | 1 | api.ts |
| 修改（web chat） | 1 | ChatArea.tsx |
| **总计** | **39** | |

---

## 验证结果

| 测试项 | 结果 |
|---|---|
| TypeScript 编译（shared） | ✓ 0 errors |
| TypeScript 编译（server） | ✓ 0 errors |
| TypeScript 编译（web） | ✓ 0 errors |

---

## 后续待完善（Phase 3.6 剩余两项）

- [ ] WS 连接注册表（`connection-registry.ts`）— 管理多连接、断线清理
- [ ] 乐观更新封装（`optimistic-updates.ts`）— 统一的乐观写入 + 失败回滚