# Mobile Phase 2 开发完成文档

**完成日期：** 2026-06-06

> **最后更新：** 2026-06-06 — 产物内联预览 + 文件变更确认 + 成员信息面板 + UI 优化

---

## 概述

Mobile Phase 2 在 Phase 1 MVP 基础上实现三项核心用户体验增强：

1. **消息内联产物预览**：对话历史中直接嵌入网页/文本/PPT/文件预览卡片，复用 web 端卡片组件
2. **文件变更确认弹窗**：run 结束后在聊天页顶部弹出文件变更列表，支持 apply/revert，替代全屏 ApprovalPage 跳转
3. **成员信息面板**：顶部 "···" 菜单 → 底部弹出成员列表（AgentBadge + 能力标签），只读不可管理

同时修复了多个 Phase 1 遗留的数据流 bug。

---

## 一、文件清单

### 1.1 新建文件

| 文件 | 说明 |
|---|---|
| `apps/mobile/src/components/mobile-artifact/MobileInlineArtifactCard.tsx` | 产物类型路由：网页→WebPreviewCard、文本→TextPreviewCard、PPT→PptxViewerCard、其他→DownloadCard |
| `apps/mobile/src/components/mobile-chat/MobileFileChangePopup.tsx` | 文件变更确认弹窗：顶部弹出卡片，pending 文件列表 + 可展开 diff + apply/revert 按钮 |
| `apps/mobile/src/components/mobile-chat/MobileMemberSheet.tsx` | 底部弹出成员信息面板：AgentBadge + 名称 + 👑Host 标识 + 能力标签（只读） |

### 1.2 修改文件

| 文件 | 改动说明 |
|---|---|
| `apps/mobile/src/pages/ChatPage.tsx` | ① `runArtifacts` 状态（按 runId 分组 + 路径去重）；② `showFileChangePopup` 状态 + run:completed 触发；③ `showMemberSheet` 状态 + 成员数据获取（getConversationAgent + listMembers 移入.then）；④ Header 重构（标题居中 + "···" 按钮）；⑤ `capabilitiesJson` 字段修复 |
| `apps/mobile/src/components/mobile-chat/MobileMessageList.tsx` | ① 新增 `runArtifacts` prop + 消息下方渲染 `MobileInlineArtifactCard`；② 移除 `memberCapabilities` prop（能力标签只显示在成员面板） |
| `apps/mobile/src/components/mobile-chat/MobileMessageBubble.tsx` | 移除 `CapabilityTags` import + `capabilities` prop + 渲染块（能力标签只显示在成员面板） |
| `apps/mobile/src/stores/mobile-ui.store.ts` | 新增 `permissionWsSender` 模块级 holder（不在 Zustand state 中，避免 re-render） |
| `apps/mobile/src/pages/ApprovalPage.tsx` | 权限审批从 HTTP POST 改为 WebSocket `permission:respond` 消息 |
| `apps/mobile/package.json` | 新增 `pptxviewjs` 依赖（PPT Canvas 渲染） |

---

## 二、功能详解

### 2.1 消息内联产物预览

**数据流**：`listArtifactsByConversation()` API 初始加载 + `artifact:created` WS 事件实时更新 → 按 `runId` 分组 + 路径去重 → 在 agent 消息下方以内联卡片形式展示。

**类型路由**（MobileInlineArtifactCard）：

| 条件 | 组件 | 说明 |
|---|---|---|
| `type === "webpage"` 或 `mimeType === "text/html"` | `WebPreviewCard` | iframe 内嵌网页预览（与 web 一致） |
| `mimeType` 以 `text/` 开头，或 `application/json`、`application/javascript` | `TextPreviewCard` | 语法感知代码预览，maxLines=120, maxChars=40000 |
| `mimeType` 包含 `presentation` 或文件名 `.pptx` | `PptxViewerCard` | Canvas 幻灯片预览，支持触摸滑动 |
| 其他 | `DownloadCard` | 文件名 + 大小 + 下载按钮 |

**宽度约束**：`max-w-[85%]` 与消息气泡一致，PPT 卡片额外添加 `overflow-hidden rounded-lg` 防止 Canvas 最小宽度溢出。

### 2.2 文件变更确认弹窗

**问题背景**：
- 适配器默认 `permissionMode: "bypass"`，CLI 不发出 `permission_request` 事件
- 移动端没有 web 的工作区面板（WorkspacePanel），用户无法看到文件变更
- Phase 1 的 ApprovalPage 只在 `permission:requested` 时 push（此事件永不触发）

**解决方案**：
- `run:completed` 事件到达时检查 `useWorkspaceStore.fileChanges` 中 `status === "pending"` 的条目
- 有 pending 变更时显示 `MobileFileChangePopup`（非全屏页面，而是聊天页顶部弹出卡片）
- 弹窗渲染在滚动区外部（`flex-shrink-0`），不会被消息滚动带出视野

**交互**：
- 每个文件：类型标签（+/~/−）+ 文件名 + 可展开 diff + 应用/回退按钮
- 全部处理完后自动消失，也可点 ✕ 手动关闭
- 切换会话时自动重置弹窗状态

### 2.3 成员信息面板

**Header 重构**：
```
之前: [←] [AgentBadges + 标题...............] [·]
之后: [←] [·········标题·········] [·] [···]
```

- 标题居中显示（`flex-1 text-center truncate`）
- Agent badges 从头像栏移出，集成到底部弹出中
- 右侧新增 "···" 按钮 + 保留运行指示灯

**底部弹出**（MobileMemberSheet）：
- 群聊：标题 "Agent · N"，列表展示所有成员
- 私聊：标题 "对话信息"，列表展示单个 Agent
- 每个成员：AgentBadge + 名称 + 👑Host 标识 + 能力标签（`formatCapability`）
- 只读展示，无"新增"/"移除"等管理按钮（与 web 端区别）
- 点击遮罩或 ✕ 关闭

---

## 三、Bug 修复

### 3.1 群聊成员从未加载

**根因**：`listMembers()` 在 useEffect 同步代码体中检查 `convType`，但 `convType` 要等 `getConversation().then()` 的异步回调才被 `setConvType` 更新。初始值永远是 `"direct"`，所以群聊的 `listMembers` 从未执行。

**修复**：将 `listMembers()` 移入 `.then()` 回调内，直接使用 API 返回的 `c.type`。

### 3.2 私聊 agent 信息为空

**根因**：`sheetMembers` 依赖 `agentMap[conversationId]`，但 `agentMap` 来自 `useConversationStore.load()` —— 移动端进入 ChatPage 时 store 可能尚未加载。

**修复**：
- 新增 `getConversationAgent(conversationId)` API 调用获取 agentId
- 新增 resolution useEffect：agentId 拿到后从 agents store 匹配详情 → `convAgentInfo`
- `sheetMembers` 优先用 `convAgentInfo`（状态），`agentMap` 作为回退

### 3.3 能力标签不显示

**根因**：`AgentRow` 有独立的 `capabilitiesJson` 字段（JSON 数组 `[{ label, value }]`），但代码在 `configJson` 里找 `.capabilities` 子属性，永远找不到。

**修复**：直接解析 `a.capabilitiesJson`，提取 `label` 字段（与 web ChatArea 一致）。

### 3.4 审批 HTTP 端点不存在

**根因**：`ApprovalPage` 使用 `respondToPermission(runId, permissionId, approved)` → `POST /api/runs/:runId/permissions`，但服务端没有此路由。Web 的 ChatArea 使用 WebSocket `permission:respond` 消息。

**修复**：
- 创建 `permissionWsSender` 模块级 holder（不在 Zustand state 中避免 re-render）
- ChatPage 在 WebSocket 连接就绪后将 `wsSend` 写入 holder
- ApprovalPage 从 holder 读取 `send`，发送 `{ type: "permission:respond", runId, permissionId, approved }`

### 3.5 文件变更弹窗滚出视野

**根因**：弹窗使用 `absolute top-0` 定位在 `overflow-y-auto` 的消息区内部，消息列表自动滚底后弹窗被滚出视野。

**修复**：弹窗移出滚动区，放在 `MobilePinnedContext` 和 `Messages` 之间的正常流中，使用 `flex-shrink-0`。

### 3.6 状态命名冲突

**根因**：`convAgentInfo` 同时是 state 变量（line 43）和局部变量 `agentMap[conversationId]`（line 353），后者覆盖前者。

**修复**：局部变量重命名为 `convAgentFromMap`。

---

## 四、验证结果

| 验证项 | 状态 |
|---|---|
| TypeScript check：全部通过 | ✅ |
| 移动端产物内联预览（网页/文本/PPT/下载卡片）正常显示 | ✅ |
| 产物卡片宽度与消息气泡一致（max-w-[85%]） | ✅ |
| WebSocket 权限审批（permission:respond）正常 | ✅ |
| run:completed 后文件变更弹窗正确弹出 | ✅ |
| 弹窗不会被消息滚动带出视野 | ✅ |
| 文件变更 apply/revert API 调用正常 | ✅ |
| Header 标题居中 + "···" 按钮 | ✅ |
| 成员信息底部弹出正确显示（群聊/私聊） | ✅ |
| 能力标签（formatCapability）正确展示 | ✅ |
| 消息气泡中不再显示能力标签 | ✅ |
| 群聊成员数据正确加载（listMembers 异步修复） | ✅ |
| 私聊 agent 信息正确获取（getConversationAgent） | ✅ |
| PPT 预览（pptxviewjs Canvas）正常渲染 | ✅ |
| web 端功能不受影响 | ✅ |

---

## 五、Git 提交记录

| Commit | 说明 |
|---|---|
| 待提交 | Feat: mobile inline artifact preview (WebPreviewCard/TextPreviewCard/PptxViewerCard/DownloadCard) |
| 待提交 | Feat: mobile file change popup + member info bottom sheet |
| 待提交 | Fix: capabilitiesJson field + listMembers async timing + agentMap fallback |
| 待提交 | Fix: permission approval HTTP→WebSocket (permissionWsSender) |
