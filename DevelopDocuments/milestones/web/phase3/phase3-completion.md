# Phase 3 完成日志

**日期：** 2026-05-29
**状态：** 已完成

---

## 概述

Phase 3（产物与部署 + 前端架构升级）：文件变更捕获 → 产物展示完整数据链路；安全服务（加密存储 + 审计日志）；前端架构由 useState 迁移至 Zustand（7 个独立 store）；聊天组件拆分。

## 关键决策

| 决策 | 选择 | 理由 |
|---|---|---|
| 快照时机 | Run 启动前（before）+ Run 完成后（after） | 精确捕获文件变更 |
| Manifest 格式 | `{ "路径": { hash: "sha256", size: number } }` | SHA-256 哈希，轻型可对比 |
| Diff 生成 | before/after manifest hash 比对 | 不同 hash → modify |
| Secrets 加密 | AES-256-GCM，密钥派生自 `ENCRYPTION_SECRET` | 256 位密钥，GCM 认证模式防篡改 |
| Secret 防护 | `sanitizeContent()` 替换为 `[SECRET:name]` | 防止进入消息/日志/tool result |
| 部署模式 | 本地 `node -e` mini server + JSON zip 归档 | 纯 Node.js，无外部依赖 |
| Artifact 缓存 | `data/artifacts/<id>/` 目录复制 | 原始文件保留工作区，缓存独立生命周期 |
| 前端状态管理 | Zustand — 7 个独立 store | 各司其职，集中式 event-dispatcher 解耦 |

---

## 交付物

### 3.1 File Changes 闭环

| 文件 | 说明 |
|---|---|
| `services/workspace.service.ts` | ensureWorkspace / generateManifest / diffSnapshots / applyFileChange / revertFileChange |
| `services/agent-runtime.service.ts` | before/after snapshot 自动化集成 |
| `routes/file-changes.ts` | 5 个 REST 端点 + WS 广播 |
| `components/workspace/DiffCard.tsx` | 颜色编码差异卡片 |
| `components/workspace/FileChangeList.tsx` | 变更列表 + apply/revert |

### 3.2 Artifact 系统

| 文件 | 说明 |
|---|---|
| `services/artifact.service.ts` | createArtifact / listByRun / listByConversation / static file serving |
| `routes/artifacts.ts` | 6 个端点（CRUD + deploy + static serve） |
| `components/artifact/ArtifactCard.tsx` | 产物卡片基类 |
| `components/artifact/WebPreviewCard.tsx` | iframe 网页预览 |
| `components/artifact/DownloadCard.tsx` | 下载卡片 |

### 3.3 部署

| 文件 | 说明 |
|---|---|
| `services/deploy.service.ts` | startLocalPreview / createZipDownload / stopPreview |
| `routes/deployments.ts` | 5 个端点（preview / zip / download / stop） |
| `components/artifact/DeployStatusCard.tsx` | 部署状态卡片 |

### 3.4 安全服务

| 文件 | 说明 |
|---|---|
| `services/security.service.ts` | AES-256-GCM 加解密 / sanitizeContent / writeAuditLog / assessCommandRisk |
| `routes/secrets.ts` | 3 个端点（list/create/delete，永不返回解密值） |
| `db/schema.ts` | 新增 `secrets` + `audit_logs` 表 |

### 3.5 Workspace 前端面板

| 文件 | 说明 |
|---|---|
| `components/workspace/FileTree.tsx` | VSCode 风格文件树 |
| `components/workspace/SnapshotList.tsx` | 快照时间线 |
| `components/workspace/WorkspacePanel.tsx` | 右侧面板（三 Tab：文件/快照/变更） |

### 3.6 前端架构升级

- **7 个 Zustand stores**：conversation / message / agent / run / artifact / workspace / ui
- **Zod schemas**：artifact.schema.ts / workspace.schema.ts
- **Event dispatcher**：`lib/event-dispatcher.ts` — 12 种 WS 事件自动分发
- **组件拆分**：MessageBubble / MessageList / ConversationSearchBar 独立文件

### 3.7 Shared 类型扩展

- `types/artifact.ts` — ArtifactRow, ArtifactType, DeployStatus
- `types/workspace.ts` — WorkspaceRef, Manifest, FileEntry, Snapshot, FileChange
- `schemas/artifact.schema.ts` / `schemas/workspace.schema.ts` — 7 个 Zod schema
- `constants.ts` — SANDBOX_MODES, ARTIFACT_TYPES, DEPLOY_STATUSES 等扩展

---

## 核心数据链路

### 文件变更 → 产物

```
startDirectRun()
├── ensureWorkspace + createSnapshot("before")
├── Adapter.run()
├── createSnapshot("after")
├── diffSnapshots(before, after) → DB file_changes
├── ArtifactService.createArtifact() → artifacts 表
└── WS broadcast file:changed / artifact:created
```

### Secret 安全链路

```
POST /api/secrets → encrypt(value) AES-256-GCM → encrypted_value 写 DB
→ sanitizeContent() 防护泄露 → run 结束后清理引用
```

---

## 验证结果

| 验证项 | 状态 |
|---|---|
| TypeScript 编译（shared / server / web） | ✅ |
| before/after snapshot 自动化 + diff 检测 | ✅ |
| file:changed WS 广播 + 前端实时更新 | ✅ |
| Artifact CRUD + static file serving | ✅ |
| deploy local-static + zip download | ✅ |
| Secret 加密存储 + sanitize 防护 | ✅ |
| WorkspacePanel 三 Tab（文件树/快照/变更） | ✅ |
| 7 个 Zustand stores + event-dispatcher | ✅ |
| 组件拆分（MessageBubble / MessageList / SearchBar） | ✅ |

---

## 下一步：Phase 4

产物 pipeline 与前端架构已就绪，Phase 4 将聚焦体验深度与稳定性。工作项：
1. Agent 短期记忆 — buildAgentContext() 注入对话历史到 system prompt
2. Diff 展示完善 — unified diff 渲染 + DiffBlock 统一组件 + 跨组件联动
3. WorkspacePanel 集成 — 文件内容查看、快照回滚、面板拖拽、工作目录管理
4. 富媒体内联展示 — InlineDiffCard / InlineArtifactCard 按 runId 内联到消息下方
5. 稳定性修复 — EPIPE 崩溃、Agent 卡死、FileChange 去重、tsx watch 优化
