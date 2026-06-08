# Phase 7 方案：全屏预览 + 代码编辑器

**日期：** 2026-06-07

---

## 一、全屏预览（点击卡片展开）

### 需求
点击聊天中的内联产物卡片 → 全屏模态框预览，支持网页、PPT、图片、代码。

### 实现方案

**1.1 FullscreenPreviewModal 组件**

```
props:
  artifact: ArtifactRow
  onClose: () => void

渲染逻辑：
  webpage → 全屏 iframe
  image   → 全屏 <img>
  pptx    → 全屏 PptxViewerCard
  text    → 全屏代码查看器（或跳转到代码编辑器）
```

**1.2 触发入口**

每种 InlineArtifactCard 内部已有的折叠/展开按钮改为全屏：
- WebPreviewCard → 「全屏」按钮 → FullscreenPreviewModal
- TextPreviewCard → 「全屏」按钮 → 代码编辑器或全屏文本
- PptxViewerCard → 「全屏」按钮 → FullscreenPreviewModal
- ImageSlideshowCard → 「全屏」按钮 → FullscreenPreviewModal

**1.3 交互设计**

- 全屏模态框：`fixed inset-0 z-50 bg-black/90`
- 右上角 ✕ 关闭、Esc 关闭
- 动画：scale(0.95) → scale(1) 弹入

### 涉及文件
| 文件 | 操作 |
|---|---|
| `src/components/artifact/FullscreenPreviewModal.tsx` | 新建 |
| `InlineArtifactCard.tsx` | 每个卡片加全屏入口 |
| `WebPreviewCard.tsx` | 添加 onExpand 回调 |
| `TextPreviewCard.tsx` | 添加 onExpand 回调 |
| `PptxViewerCard.tsx` | 已有导航，加全屏入口 |

---

## 二、代码编辑器（工作区内编辑文件）

### 需求
在工作区面板或独立窗口中，用真正的代码编辑器打开并编辑 workspace 中的文件，保存后实时生效。

### 实现方案

**2.1 编辑器选型：Monaco Editor**

`@monaco-editor/react` — VS Code 同款编辑器引擎：
- 语法高亮（TS/JS/Python/Go/HTML/CSS/JSON 等全部支持）
- 智能补全
- 多标签页
- 深色/浅色主题
- 仅 5MB（gzipped ~1.5MB）

```
pnpm add @monaco-editor/react
```

**2.2 CodeEditorPanel 组件**

```
┌──────────────────────────────────────┐
│ 文件标签: [index.html] [style.css] [app.js]  │  ← 多标签页
├────────────┬─────────────────────────┤
│            │                         │
│  文件树     │    Monaco Editor        │
│  (复用)     │    (语法高亮+补全)       │
│            │                         │
│            ├─────────────────────────┤
│            │ 状态栏: 已保存 / 未保存   │
└────────────┴─────────────────────────┘
```

**2.3 数据流**

```
选中文件
  → GET /api/workspaces/:id/file-content?path=xxx
  → 编辑器加载内容
  → 用户编辑
  → Ctrl+S / 点击保存
  → PUT /api/workspaces/:id/file-content?path=xxx (body: { content })
  → 保存到磁盘
  → 前端标记"已保存"
```

**2.4 触发入口**

| 入口 | 行为 |
|---|---|
| 工作区文件树 → 点击文件 | 在编辑器面板中打开 |
| TextPreviewCard → 「编辑」按钮 | 打开 CodeEditorPanel |
| InlineArtifactCard（代码文件）→ 点击 | 打开 CodeEditorPanel |

**2.5 后端新增 API**

```
PUT /api/workspaces/:id/file-content?path=xxx
Body: { content: string }
→ 写入 workspace 目录
→ 返回 { ok: true }
```

### 涉及文件
| 文件 | 操作 |
|---|---|
| `src/components/workspace/CodeEditorPanel.tsx` | 新建（Monaco 编辑器 + 标签页） |
| `src/components/workspace/WorkspacePanel.tsx` | 添加"代码编辑器"标签页 |
| `src/components/artifact/TextPreviewCard.tsx` | 添加「编辑」按钮 |
| `apps/server/src/routes/workspaces.ts` | 新增 PUT file-content 端点 |
| `apps/web/src/lib/api.ts` | 新增 saveFileContent API |
| `apps/web/package.json` | 添加 @monaco-editor/react |
| `Apps/web/src/components/artifact/FullscreenPreviewModal.tsx` | 新建 |

---

## 三、执行顺序

```
Phase 7.1: 全屏预览（2h）
  1. FullscreenPreviewModal 组件
  2. 各种卡片接入
  3. 测试

Phase 7.2: 代码编辑器（3h）
  1. 安装 Monaco Editor
  2. 后端 PUT file-content API
  3. CodeEditorPanel 组件
  4. 文件树 + 标签页集成
  5. 测试

Phase 7.3: 联动（1h）
  1. TextPreviewCard → 编辑器跳转
  2. 全屏预览 → 编辑器跳转
  3. 测试
```

---

## 四、注意事项

1. **Monaco Editor 体积** — 首次加载约 5MB，建议懒加载
2. **文件保存** — 需要后端路径安全校验（防目录穿越）
3. **多文件冲突** — Agent 正在运行时用户手动编辑可能冲突，需要提示
4. **大文件** — 超过 500KB 的文件不加载编辑器，降级为只读文本预览
