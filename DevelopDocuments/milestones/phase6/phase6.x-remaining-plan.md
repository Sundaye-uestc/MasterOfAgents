# Phase 6.x 待完成事项详细规划

**日期：** 2026-06-06

---

## 一、自建 Agent 修改头像功能

### 现状
- Agent 表已有 `avatar` 字段（`routes/agents.ts:174` 支持 PATCH 更新）
- AgentBadge 组件已支持 `avatar` prop（`AgentBadge.tsx`）
- 创建 Agent 时不传 avatar，编辑弹窗（AgentEditModal）无头像上传入口

### 实施步骤

1. **后端** — 已就位，无需修改
   - `PATCH /api/agents/:id` 已支持 `avatar` 字段（base64 或 URL）
   - 验证：`curl -X PATCH ... -d '{"avatar":"data:image/..."}'`

2. **前端 AgentEditModal** — 添加头像上传
   - 在「名称」之前添加头像区域
   - 点击头像 → 弹出文件选择器（accept="image/*"）
   - FileReader 读取为 base64 → 存入 `avatar` 状态
   - 保存时一并提交 `avatar` 字段

3. **前端 AgentManagePanel** — 头像回显
   - AgentBadge 已支持 avatar，确认 `agent.avatar` 正确传递

### 涉及文件
- `apps/web/src/components/agent/AgentEditModal.tsx` — 添加头像上传
- `apps/server/src/routes/agents.ts` — 已支持，无需修改

---

## 二、新增内置 Agent OpenCode

### 现状
- 系统已有 `default-claude` 和 `default-codex` 两个内置 Agent
- `seed.ts` 在服务启动时写入 DB（已存在的不会覆盖）
- OpenCode CLI 类似 Codex，使用 `opencode` 命令

### 实施步骤

1. **添加 seed 数据**（`db/seed.ts`）
   - 新增 `default-opencode` 记录
   - adapterKind: `opencode`
   - capabilities: `["code-generation", "code-review", "debugging"]`

2. **创建 OpenCode Adapter**（可选，可复用 CodexAdapter）
   - CodexAdapter 已支持 `platform: "opencode"` → CLI 命令自动切换为 `opencode`
   - 只需在 Agent 配置中设置 `adapterKind: "opencode"`

3. **前端 AgentPicker** — 确认 OpenCode 出现在列表中

4. **验证** — 创建单聊选择 OpenCode，测试功能

### 涉及文件
- `apps/server/src/db/seed.ts` — 添加 seed 记录
- `apps/server/src/adapters/codex.adapter.ts` — 已支持 opencode，无需修改

---

## 三、刷新后思考时间显示 1s（低优先级）

### 根因分析

`MessageBubble.tsx` 中思考时间是通过本地 `useRef(Date.now())` 计算的：
```typescript
const startRef = useRef<number>(Date.now());
const [thinkingMs, setThinkingMs] = useState<number | null>(null);

useEffect(() => {
  if (isStreaming && !message.content) {
    startRef.current = Date.now();
  }
  if (!isStreaming && message.content && thinkingMs === null) {
    setThinkingMs(Date.now() - startRef.current);
  }
}, [isStreaming, message.content, thinkingMs]);
```

刷新后组件重新挂载，`startRef` 被重新初始化为当前时间，`isStreaming` 为 false，但 `thinkingMs` 为 null，触发了条件 `!isStreaming && message.content && thinkingMs === null`，于是计算出 `Date.now() - startRef.current ≈ 1s`。

### 修复方案

方案 A：**消息表新增 `thinkingMs` 字段**（最可靠）
- 服务端在 `run_completed` 时计算并保存
- 前端直接读取，不依赖本地 ref

方案 B：**前端判断消息是否已完成**
- 只有 `status === "sent"` 且 `message.createdAt` 在合理范围内时才启用动画效果
- 对已完成的消息直接显示 `createdAt` 时间戳

### 推荐：方案 B（改动最小）

```typescript
useEffect(() => {
  if (isStreaming && !message.content) {
    startRef.current = Date.now();
  }
  if (!isStreaming && message.content && thinkingMs === null) {
    // 只对最近结束的消息计算思考时间，刷新后不重新计算
    const elapsed = Date.now() - startRef.current;
    const msgAge = Date.now() - new Date(message.updatedAt || message.createdAt).getTime();
    if (msgAge < 5000) {
      setThinkingMs(elapsed);
    }
  }
}, [isStreaming, message.content, thinkingMs]);
```

### 涉及文件
- `apps/web/src/components/chat/MessageBubble.tsx` — 修复思考时间计算

---

## 执行顺序

```
1. OpenCode 内置 Agent（最独立，10 分钟）
2. Agent 头像功能（20 分钟）
3. 思考时间 bug（10 分钟，低优先级）
```
