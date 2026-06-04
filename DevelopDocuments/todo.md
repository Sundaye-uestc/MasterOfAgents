# AgentHub 待办事项

**更新日期：** 2026-06-04

---

## Phase 2 待完善

- [ ] Codex CLI 安装与端到端验证（运行时自动降级为 ClaudeCodeAdapter）

---

## PPT 预览

- [x] PPT 预览已完成 — ImageSlideshowCard 轮播组件 + slideshow artifact 合并逻辑 + pptxviewjs Canvas 渲染 PptxViewerCard（2026-06-04）

---

## 4.5 用户自建 Agent

- [ ] 对话式创建 Agent
- [ ] 自定义 System Prompt
- [ ] 工具集配置
- [ ] Agent 管理界面

---

## 🐛 已知 Bug

- [ ] 群聊 artifact 跨 Agent 冗余展示（4.4 遗留）

---

## 当前风险

| 风险 | 状态 | 应对 |
|---|---|---|
| Codex CLI 未跑通 | 代码已完成 | 安装 CLI + 配置 Key |
| 多 Agent 文件写入冲突 | 已应对 | 写入范围检测、串行化 |

---

## ✅ 2026-06-04 已完成

### 上游合并
- [x] 合并 upstream/wip — 46 文件, Phase 5 PPT/Slideshow/pptx-parser
- [x] 合并 upstream/master — 28 文件, PPTX viewer/pptx_to_preview

### 浅色/深色主题
- [x] 主题切换按钮（侧边栏标题旁 ☀️/🌙）
- [x] 25+ 组件浅色适配（bg/border/text + dark: 变体）

### UI 重构（GPT/Gemini 风格）
- [x] 全局圆角提升（rounded-lg → 2xl，rounded → lg/xl）
- [x] 输入框药丸形 + 左侧 + 上传按钮（文档/PDF/代码）
- [x] 消息气泡操作栏底部常驻（Agent）/ hover 显示（用户）
- [x] 思考时间显示（脉冲圆点 + "已思考 Xs"）
- [x] 复制按钮反馈（对勾动画）
- [x] 点赞/不点赞切换反馈
- [x] 全局边框软化（不透明度降至 50%）

### 快照系统
- [x] 有意义标签（对话标题 + 消息预览）
- [x] 时间线布局重写（竖线 + 圆点）
- [x] 展开查看文件变更 + diff 行数
- [x] 回滚 Toast 反馈
- [x] 回滚按钮带图标（始终可见）
- [x] 点击快照 → 聊天框定位到对应消息
- [x] 只显示「对话后」快照（去重）

### 环境/基础设施
- [x] pptxgenjs 全局安装 + NODE_PATH 配置
- [x] dotenv 安装 + .env 自动加载
- [x] PptxViewerCard 接入 InlineArtifactCard（浏览器预览 .pptx）

### 浅色模式专项
- [x] 文件树悬停/选中背景
- [x] Diff 颜色（绿/红/蓝浅色变体）
- [x] 状态标签（applied/pending/deployed/success/error）
- [x] 代码块背景
- [x] Orchestrator/PinnedMessageBar 背景

### 文档
- [x] 群聊测试方案（phase5.x-group-chat-test-plan.md）
