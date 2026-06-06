# Mobile Phase 1 开发完成文档

**完成日期：** 2026-06-06

> **最后更新：** 2026-06-06 — MVP 移动端全部功能 + 基础设施

---

## 概述

Mobile Phase 1 实现移动端 MVP 全功能：会话列表、消息查看/发送、WebSocket 实时同步、运行状态监控、审批面板、产物预览、设置页，以及跨端头像同步后端 API。

- **项目结构**：monorepo 内 `apps/mobile/`，与 web/server 平级，复用 web 端 stores/API/hooks/叶子组件
- **导航**：Zustand stack 导航，无需 router，与 web 端 useState 条件渲染模式一致
- **组件复用**：叶子组件（AgentBadge、GroupAvatar、MarkdownContent 等）直接引用 web，页面级组件独立实现
- **跨端同步**：新增 `GET/PUT /api/profile` 后端接口，头像从 localStorage 迁移到服务端

---

## 一、文件清单

### 1.1 新建文件 — apps/mobile/

| 文件 | 说明 |
|---|---|
| `apps/mobile/package.json` | `@agenthub/mobile`，依赖 web + shared workspace |
| `apps/mobile/tsconfig.json` | extends base，ES2022 + DOM + react-jsx |
| `apps/mobile/vite.config.ts` | React + Tailwind v4 + PWA 插件 + shared-assets 中间件，端口 5174 |
| `apps/mobile/index.html` | viewport-fit=cover + PWA meta + 暗色模式默认 |
| `apps/mobile/public/manifest.json` | PWA 清单 |
| `apps/mobile/src/main.tsx` | React 18 StrictMode 入口 |
| `apps/mobile/src/index.css` | Tailwind v4 + @source 扫描 web 组件 + safe-area + touch-target 工具类 |
| `apps/mobile/src/App.tsx` | 根组件：读 mobile-ui.store 栈顶，条件渲染各页面 |
| `apps/mobile/src/vite-env.d.ts` | Vite + PWA 类型声明 |
| `apps/mobile/src/stores/mobile-ui.store.ts` | 唯一移动端专属 store：stack[] + isOnline + push/pop/goHome |
| `apps/mobile/src/hooks/useNetworkStatus.ts` | 监听 online/offline + 周期 ping `/api`，断网推送 offline 页 |
| `apps/mobile/src/pages/OfflinePage.tsx` | "未连接到网络"提示 + 重试按钮 |
| `apps/mobile/src/pages/ConversationListPage.tsx` | 会话列表首页：搜索 + 列表 + FAB 新建 + 管理成员弹窗 |
| `apps/mobile/src/pages/ChatPage.tsx` | 聊天页：消息列表 + WebSocket 同步 + 发送 + Run 停止 |
| `apps/mobile/src/pages/ApprovalPage.tsx` | 审批页：权限请求审批 + Diff apply/revert |
| `apps/mobile/src/pages/ArtifactPreviewPage.tsx` | 产物预览：网页链接 + Diff 摘要 + 文件查看 + 部署 |
| `apps/mobile/src/pages/SettingsPage.tsx` | 设置页：个人资料（头像上传/更换/移除）+ 暗色模式 + 版本信息 |
| `apps/mobile/src/components/mobile-chat/MobileConversationItem.tsx` | 会话列表项："···"弹窗菜单（置顶/重命名/管理成员/归档/删除） |
| `apps/mobile/src/components/mobile-chat/MobileConversationSearchBar.tsx` | 搜索框 |
| `apps/mobile/src/components/mobile-chat/MobileNewConversationModal.tsx` | 底部滑出新建会话弹窗 |
| `apps/mobile/src/components/mobile-chat/MobileMessageList.tsx` | 消息列表：日期分组 + 工具调用 + 自动滚底 |
| `apps/mobile/src/components/mobile-chat/MobileMessageBubble.tsx` | 消息气泡：Agent/User/System 三态，AgentBadge + MarkdownContent |
| `apps/mobile/src/components/mobile-chat/MobileMessageInput.tsx` | 底部输入栏：多行自适应 + visualViewport 键盘适配 + 发送/停止 |
| `apps/mobile/src/components/mobile-chat/MobileMentionPicker.tsx` | @提及 Agent 选择器 |
| `apps/mobile/src/components/mobile-chat/MobilePinnedContext.tsx` | 置顶消息条 |
| `apps/mobile/src/components/mobile-run-status/RunStatusBanner.tsx` | 运行状态横幅：可展开/折叠 + 进度条 |
| `apps/mobile/src/components/mobile-run-status/TaskProgressList.tsx` | 任务进度列表 |
| `apps/mobile/src/components/mobile-run-status/ToolInvocationList.tsx` | 工具调用展开列表 |
| `apps/mobile/src/components/mobile-run-status/StopRunButton.tsx` | 红色停止按钮 |
| `apps/mobile/src/components/mobile-artifact/MobileArtifactCard.tsx` | 消息内嵌产物卡片 |
| `apps/mobile/src/components/mobile-artifact/MobileDiffSummary.tsx` | Diff 摘要（+/- 统计 + 可展开代码） |
| `apps/mobile/src/components/mobile-artifact/MobileWebPreviewLink.tsx` | "在浏览器中打开"网页链接 |
| `apps/mobile/src/components/mobile-artifact/MobileFileViewer.tsx` | 文件内容只读查看（代码/文本/Markdown） |
| `apps/mobile/src/components/mobile-artifact/MobileDeployStatus.tsx` | 部署状态 + 部署按钮 |

### 1.2 新建文件 — 服务端

| 文件 | 说明 |
|---|---|
| `apps/server/src/routes/profile.ts` | `GET /api/profile` 读取 + `PUT /api/profile` 更新用户头像 |

### 1.3 新建文件 — 基础设施

| 文件 | 说明 |
|---|---|
| `shared-assets/agents/` | 共享静态资源目录，存放 Agent logo 图片（claude-code/codex/opencode） |
| `start_mobile.py` | 移动端启动脚本（后端 + mobile，后端已运行时复用） |
| `start_web.py` | Web 端启动脚本（后端 + web） |
| `stop_dev.py` | 一键停服脚本 |
| `.logs/` | 服务日志输出目录 |

### 1.4 修改文件

| 文件 | 说明 |
|---|---|
| `apps/web/package.json` | 添加 `exports` 字段（stores/lib/hooks/components），使 mobile 可以 import |
| `apps/web/vite.config.ts` | 添加 `sharedAssetsPlugin()` 中间件，从 `shared-assets/` 提供 `/agents/*` |
| `apps/web/src/hooks/useUserAvatar.ts` | 从 localStorage 改为调用 `/api/profile`，fallback 自动迁移旧数据 |
| `apps/web/src/lib/api.ts` | 新增 `getProfile()` / `updateProfile()` 函数 |
| `apps/server/src/db/schema.ts` | 新增 `user_profile` 表 |
| `apps/server/src/db/migrate.ts` | 新增 `user_profile` 建表语句 |
| `apps/server/src/app.ts` | 注册 `/api/profile` 路由 |
| `start_dev.py` | 重写：`DETACHED_PROCESS` 子进程分离 + 日志文件输出，新增 mobile 服务 |
| `AgentHub/package.json` | 新增 `dev:mobile` 脚本 |

---

## 二、移动端页面

### 2.1 会话列表（ConversationListPage）

- **数据流**：直接 import `useConversationStore` from `@agenthub/web`，调用 `load()` 加载会话列表
- **群聊头像**：import `GroupAvatar`，通过 `Promise.all(listMembers())` 加载成员数据，传入 `membersMap`
- **"···" 菜单**：与 web 端完全一致的弹窗菜单——📌置顶/取消置顶、✍️重命名、👥管理成员（群聊）、📦归档/取消归档、🗑️删除
- **搜索**：300ms 防抖过滤
- **新建会话**：FAB 按钮 → 底部滑出弹窗，支持单聊/群聊切换，Agent 选择（复用 web 端列表但适配移动端布局）
- **管理成员**：模态弹窗，列表展示成员（带头像 + 👑Host 标识），图形化添加（点击高亮蓝框 + ✓），❌移除

### 2.2 聊天页（ChatPage）

- **消息加载**：`useMessageStore.load()` → `.then()` 同步到本地 state（修复异步竞态导致历史消息空白）
- **Agent 头像**：构建 `nameMap`（agentId → name/adapterKind），优先从 members 获取，兜底从 `useAgentStore` 查找
- **用户头像**：复用 `useUserAvatar` hook（→ `/api/profile`），用户消息右侧显示头像或 👤 占位
- **Markdown 渲染**：复用 web 端 `MarkdownContent` 组件
- **消息气泡**：User 蓝色右对齐 + Agent 白色左对齐 + System 居中
- **日期分组**：今天/昨天/日期 分隔线
- **流式消息**：`message:delta` 事件实时拼接内容，闪烁光标指示

### 2.3 WebSocket 实时同步

- **连接**：直接 import `useWebSocket` hook from `@agenthub/web`
- **事件处理**：与 web ChatArea 相同的本地 state 模式，处理 12 种事件类型
- `message:created` → 去重追加。`message:delta` → 流式拼接
- `run:started/completed/failed` → 运行状态切换
- `task:started/completed/failed` → 任务进度更新
- `orchestrator:plan_created` → 初始化任务列表
- `tool:invocation` → 追踪每个消息的工具调用
- `file:changed` → 转发 `useWorkspaceStore().updateFileChange()`
- `artifact:created` → 追加到 `useArtifactStore`
- `permission:requested` → 自动导航到审批页

### 2.4 消息发送

- **输入栏**：底部固定，多行自适应（最大 4 行），`visualViewport` API 适配 iOS 键盘弹出
- **发送**：乐观更新（临时 ID）→ `sendMessage()` API → 替换真实消息
- **停止**：发送按钮替换为红色停止方块 → `stopRun()` API
- **@提及**：群聊中检测 `@` 触发底部弹出 `MobileMentionPicker`，点击插入 `@AgentName`

### 2.5 运行状态（Run Status）

- **RunStatusBanner**：可展开/折叠横幅，显示运行状态 + 进度条
- **TaskProgressList**：任务列表（⏳排队/🔄运行/✅完成/❌失败）
- **ToolInvocationList**：每个消息下方展示工具调用，可展开查看 Input/Output JSON
- **停止按钮**：红色方块，调用 `stopRun()` 立即取消

### 2.6 审批面板（ApprovalPage）

- **权限审批**：Agent 请求权限时自动弹出，展示工具名/描述/命令，大按钮 批准/拒绝
- **Diff 审批**：列出 `pending` 状态的文件变更，显示变更类型（+/-/~）+ 路径 + Diff 摘要，每项可 Apply/Revert
- **MobileDiffSummary**：紧凑 Diff 查看器（+/- 行数统计，每行着色，默认折叠 20 行）

### 2.7 产物预览（ArtifactPreviewPage）

- **网页预览**：`MobileWebPreviewLink` → 新标签页打开，不做内嵌 iframe
- **Diff 查看**：展开完整的 `MobileDiffSummary`
- **文件查看**：`MobileFileViewer` → 代码（monospace + 行号）、Markdown（复用 MarkdownContent）、纯文本，二进制提示不可预览
- **部署**：`MobileDeployStatus` 展示部署状态 + 部署按钮，已部署显示预览 URL

### 2.8 设置页（SettingsPage）

- **个人资料**：当前头像预览（64px 圆形），📷更换头像（调系统文件选择器 → FileReader data URL → `/api/profile`），🗑️移除（清除头像）
- **外观**：暗色模式切换（toggle `.dark` class）
- **关于**：版本号 + 定位说明

---

## 三、跨端头像同步

| 层 | 改动 |
|---|---|
| **数据库** | 新增 `user_profile` 表（id="default"，avatar TEXT） |
| **后端** | `GET /api/profile` 读取头像；`PUT /api/profile` 更新头像 |
| **API 客户端** | `getProfile()` + `updateProfile()`（web/mobile 共用 `api.ts`） |
| **useUserAvatar** | 优先从服务器加载，fallback localStorage 并自动迁移旧数据 |
| **共享资源** | `shared-assets/agents/` 存放 Agent logo，web 和 mobile 的 Vite 中间件统一提供 `/agents/*` |

---

## 四、关键架构决策

| 决策 | 说明 |
|---|---|
| monorepo 内 `apps/mobile/` | 与 web/server 平级，直接 import web 端 stores/API/hooks |
| web `exports` 字段 | 暴露 `./stores/*`、`./lib/*`、`./hooks/*`、`./components/*` |
| Zustand stack 导航 | 不用 router，`mobile-ui.store.ts` 管理页面栈，与 web 模式一致 |
| 本地 state + store 混合 | 高频更新（消息/流式/tool）用本地 useState；持久数据用 Zustand store |
| `DETACHED_PROCESS` | Windows 上子进程彻底脱离父进程，日志写入 `.logs/` 而非管道 |
| Tailwind `@source` | mobile 扫描 web 组件源码，确保复用组件的 class 被正确生成 |
| 应用内通知 | WebSocket 长连接，不做系统级推送 |
| 不做离线 | 无网络时展示 OfflinePage，不做 Service Worker 缓存 |
| 暂不认证 | MVP 阶段直接访问后端 API，无 token |

---

## 五、验证结果

| 验证项 | 状态 |
|---|---|
| `pnpm install` 成功，mobile 包加入 workspace | ✅ |
| TypeScript check：server + web + mobile 全部通过 | ✅ |
| 移动端 5174 端口启动成功 | ✅ |
| 会话列表加载，搜索过滤正常 | ✅ |
| 群聊 GroupAvatar 正确加载成员头像（正方形网格） | ✅ |
| Agent 头像显示真实 logo（非首字母缩写） | ✅ |
| 点入对话 → 历史消息正确加载 | ✅ |
| WebSocket 实时接收消息流式更新 | ✅ |
| 发送消息 → API 调用 → 乐观更新 → 流式回显 | ✅ |
| 停止 Run 成功 | ✅ |
| 审批面板：权限 approve/deny + Diff apply/revert | ✅ |
| 产物预览：网页链接/文件/Diff/部署 | ✅ |
| 设置页：头像更换/移除、暗色模式切换 | ✅ |
| `GET/PUT /api/profile` 头像跨端同步 | ✅ |
| `shared-assets/agents/` 共享资源 web+mobile 均可访问 | ✅ |
| `start_web.py` / `start_mobile.py` 分别启动成功 | ✅ |
| web 端不受影响，功能与改造前一致 | ✅ |

---

## 六、组件复用清单

| 来源 | 复用内容 | mobile 中使用位置 |
|------|---------|-------------------|
| `@agenthub/shared` | 所有 types、schemas、constants | 全局 |
| `@agenthub/web/stores/conversation.store` | 会话列表 + agentMap + CRUD | ConversationListPage、ChatPage |
| `@agenthub/web/stores/message.store` | 消息加载/发送/流式 | ChatPage |
| `@agenthub/web/stores/agent.store` | Agent 列表 + 详情 | ChatPage（nameMap fallback） |
| `@agenthub/web/stores/run.store` | 运行状态追踪 | ChatPage |
| `@agenthub/web/stores/artifact.store` | 产物 + 部署状态 | ArtifactPreviewPage、ChatPage |
| `@agenthub/web/stores/workspace.store` | 文件变更 | ApprovalPage、ChatPage |
| `@agenthub/web/lib/api.ts` | 所有 REST API 调用 | 全局 |
| `@agenthub/web/hooks/useWebSocket` | WebSocket 连接管理 | ChatPage |
| `@agenthub/web/hooks/useUserAvatar` | 用户头像加载/上传 | SettingsPage、ChatPage、ConversationListPage |
| `@agenthub/web/components/chat/AgentBadge` | Agent 头像组件 | MobileMessageBubble、MobileConversationItem |
| `@agenthub/web/components/chat/GroupAvatar` | 群聊头像拼图 | MobileConversationItem |
| `@agenthub/web/components/chat/CapabilityTags` | 能力标签（formatCapability） | MobileMessageBubble |
| `@agenthub/web/components/chat/MarkdownContent` | Markdown 渲染 | MobileMessageBubble |
| `@agenthub/web/components/chat/AgentStatusBadge` | Agent 状态指示 | ChatPage |

---

## 七、Git 提交记录

| Commit | 说明 |
|---|---|
| `9563883` | Feat: backend profile API — GET/PUT /api/profile for cross-client avatar sync |
| `824bef6` | Feat: shared-assets directory + web exports field + vite sharedAssetsPlugin |
| `64eb55c` | Feat: migrate useUserAvatar from localStorage to server API with legacy fallback |
| `fd37540` | Feat: mobile MVP — scaffold, pages, components, WebSocket, approval, artifacts, settings |
| `e9ffd9b` | Fix: launch scripts — DETACHED_PROCESS, separate web/mobile launchers, stop script |
