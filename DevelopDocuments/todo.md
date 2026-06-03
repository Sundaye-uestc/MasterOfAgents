# AgentHub 待办事项

**更新日期：** 2026-06-03

---

## Phase 2 待完善

- [ ] Codex CLI 安装与端到端验证（当前 `spawn codex ENOENT`，运行时自动降级为 ClaudeCodeAdapter；代码已完成）

---

## Phase 5 PPT 生成能力集成 ✅

全部完成，详见 [phase5-completion.md](milestones/phase5/phase5-completion.md)。

- [x] PPT 生成脚本集成 — NanoBanana 脚本迁移到 `AgentHub/ppt/`，适配路径解析
- [x] PPTX → HTML 预览转换器 — `pptx_to_preview.py` 文本/表格/图片提取 + 自包含 HTML 播放器
- [x] Artifact pipeline 增强 — `.pptx` MIME 映射 + `shouldSkipFile` 过滤（slide 图片/元数据/JS 脚本）
- [x] Agent system prompt — 中文输出偏好 + PPT 能力指令注入（claude-code + codex 两个 adapter）
- [x] Agent PPT 行为约束 — 禁止 LibreOffice / PowerShell COM / 子代理视觉审查，服务端自动生成预览
- [x] slide 图片过滤增强 — 正则从仅匹配 `images/` 子目录扩展为匹配任意目录下的 `slide*.png/jpg/webp`
- [x] 前端 PPT 展示 — `InlineArtifactCard` 新增 `isPresentation()` 分发 + 📊 下载卡片
- [x] PPTX 内联预览 — 服务端自动转换 → `type: "webpage"` artifact → WebPreviewCard iframe
- [x] SKILL.md 精简 — 675 → 105 行
- [x] Skills 目录清理 — 删除 5 个无用文件（README.md / prompt_file_reader.py / video_viewer.html / .env / .env.example）
- [x] 环境配置 — GEMINI_API_KEY 合并到根 `.env` + 依赖补充（python-dotenv / pptxgenjs）

### 当前风险

| 风险 | 状态 | 应对 |
|---|---|---|
| Codex CLI 未跑通 | **代码已完成** | 安装 `codex` CLI + 配置 API Key 后即可启用 |
| 多 Agent 文件写入冲突 | 已应对 | 写入范围检测、串行化 |

---

## Phase 4

### 4.1 Agent 记忆能力

已完成并写入 [phase4-completion.md](milestones/phase4/phase4-completion.md)。pinned 消息优先注入（最多 5 条）+ 4000 字符上下文窗口 + `[用户]`/`[AI助手]` 角色标记，已通过测试验证。

---

### 4.2 对话中 Diff 展示完善

已完成并写入 [phase4-completion.md](milestones/phase4/phase4-completion.md)。

---

### 4.3 WorkspacePanel 集成完善 ✅

端到端验证已完成（2026-06-03）。快照创建/列出/回滚/删除、文件树、文件内容 API 全部通过，修复 2 个 bug。详见 [phase4-completion.md](milestones/phase4/phase4-completion.md)。

- [x] 后端确保 manifest 数据正确生成 — workspace 的 manifest/snapshots 链路需端到端验证

---

### 4.4 Agent 回复富媒体内联展示 ✅

已完成并写入 [phase4-completion.md](milestones/phase4/phase4-completion.md)。

- [x] Diff ↔ file_changes 数据链路打通 — InlineDiffCard 内联展示 + Apply/Revert 操作，FileChangeList 从对话框顶部移至消息下方
- [x] 网页预览卡片 — WebPreviewCard 内联 iframe，支持收起/展开 + 新窗口打开
- [x] 文件附件 — 图片内联预览 + DownloadCard 下载卡片
- [x] 产物卡片统一组件 — InlineArtifactCard 根据 MIME 类型统一分发渲染（webpage / image / text → TextPreviewCard / download）
- [x] 用户直接操作 — apply/revert diff、预览网页、下载文件均在聊天流中完成（2026-06-03 修复：delete/changeType 统一显示 Apply+Revert 按钮）
- [x] 服务端 artifact 自动创建 pipeline + artifact:created WS 广播（2026-06-03 扩展：~40 种代码扩展全覆盖 + text/plain 兜底）
- [x] 文本文件内联预览 — TextPreviewCard fetch 内容直显，大文件折叠展开（2026-06-03）

### 🐛 4.4 遗留 Bug

- [ ] **前端 artifact 跨 Agent 冗余展示** — 群聊中 A 模型的消息下方也展示了 B 模型生成的文件预览（artifact/TextPreviewCard 等），原因是 artifact:created WS 广播未按 runId 隔离。解决思路参考之前的 FileChange 跨 run 去重：仅在前端 `runArtifacts` 缓存写入时做 `(path, name)` 去重，跳过已在其他 run 中展示过的 artifact。

---

### 4.5 用户自建 Agent

- [ ] 对话式创建 Agent — 用户通过自然语言描述需求，系统自动生成 Agent 配置（名称、描述、System Prompt）
- [ ] 自定义 System Prompt — 用户可编辑 Agent 的系统提示词，定义其行为与专业领域
- [ ] 工具集配置 — 用户可为自建 Agent 选择/配置可用工具集（文件读写、Shell、网络等）
- [ ] Agent 管理界面 — 列表展示自建 Agent，支持编辑、启用/禁用、删除
