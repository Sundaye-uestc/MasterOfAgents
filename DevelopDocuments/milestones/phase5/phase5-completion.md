# Phase 5 开发完成文档

**完成日期：** 2026-06-03
**最后更新：** 2026-06-04（PPT 预览完全解决）

---

## 概述

Phase 5 将 NanoBanana PPT 生成能力集成到 AgentHub，用户通过聊天即可请求 Agent 生成 PPT。核心成果：

- **PPT 生成**：Agent 用 pptxgenjs（秒级）或 Gemini AI（视觉丰富）生成 .pptx 文件
- **PPTX 预览**：双路径 — `ImageSlideshowCard`（Gemini 路径，slide 图片轮播）+ `PptxViewerCard`（pptxgenjs 路径，pptxviewjs Canvas 渲染）
- **Agent 行为约束**：v3 正面约束指令，阻止 Agent 在生成后做无意义的自我审查
- **辅助功能**：中文输出注入、SKILL.md 精简、环境配置合并、artifact pipeline 增强

---

## 一、文件清单

### 1.1 新建文件

| 文件 | 行数 | 说明 |
|---|---|---|
| `AgentHub/ppt/generate_ppt.py` | 510 | AI 图示幻灯片生成（Gemini API，路径自适应） |
| `AgentHub/ppt/pptx_to_preview.py` | 525 | PPTX → 自包含 HTML 预览（python-pptx，备用） |
| `AgentHub/ppt/styles/gradient-glass.md` | — | 渐变毛玻璃科技商务风格 |
| `AgentHub/ppt/styles/vector-illustration.md` | — | 矢量插画教育培训风格 |
| `AgentHub/ppt/prompts/transition_template.md` | — | 转场提示词模板 |
| `AgentHub/ppt/templates/viewer.html` | — | HTML 播放器模板 |
| `AgentHub/ppt/.env.example` | — | 环境变量参考 |
| `apps/web/src/components/artifact/PptxViewerCard.tsx` | ~350 | **活动** — pptxviewjs Canvas 渲染查看器（ResizeObserver 响应式 + 真实宽高比） |
| `apps/web/src/components/artifact/ImageSlideshowCard.tsx` | ~180 | **活动** — slide 图片轮播组件（键盘/触摸/点击翻页） |
| `apps/web/src/components/artifact/PptxPreviewCard.tsx` | ~197 | 已删除 — pptx-preview + iframe 方案（导致黑屏） |

### 1.2 修改文件

| 文件 | 说明 |
|---|---|
| `apps/server/src/adapters/claude-code.adapter.ts` | 中文输出 + PPT 生成指令 + QA v3 正面约束 |
| `apps/server/src/adapters/codex.adapter.ts` | 同上，与 Claude 适配器一致 |
| `apps/server/src/services/agent-runtime.service.ts` | MIME 映射 + shouldSkipFile 过滤 + PPTX→HTML 自动转换 + **slideshow artifact 合并** |
| `apps/web/src/components/chat/InlineArtifactCard.tsx` | `type === "slideshow"` → ImageSlideshowCard；PPTX → DownloadCard |
| `apps/web/package.json` | 新增 `jszip`、`pptxviewjs`、`chart.js` 依赖；移除 `pptx-preview`、`jquery` |
| `apps/web/vite.config.ts` | 新增 `chart.js/auto` alias（pnpm 严格模式兼容） |
| `skills/NanoBanana-PPT-Skills/SKILL.md` | 精简 675→55 行 + QA v3 约束 |
| `packages/shared/src/types/artifact.ts` | `ArtifactType` 新增 `"slideshow"` |
| `packages/shared/src/types/db.ts` | `ArtifactRow.type` 新增 `"slideshow"` |
| `packages/shared/src/schemas/artifact.schema.ts` | Zod enum 新增 `"slideshow"` |
| `packages/shared/src/constants.ts` | `ARTIFACT_TYPES` 新增 `SLIDESHOW` |
| `packages/shared/src/types/agent-event.ts` | `artifactType` union 新增 `"slideshow"` |
| `.env`（根目录） | 添加 `GEMINI_API_KEY` |
| `requirements.txt` | 添加 `python-dotenv` |

### 1.3 删除文件

| 文件 | 原因 |
|---|---|
| `skills/NanoBanana-PPT-Skills/README.md` (871 行) | 冗余文档，内容已覆盖 |
| `skills/NanoBanana-PPT-Skills/prompt_file_reader.py` | 视频辅助脚本，与 PPT 无关 |
| `skills/NanoBanana-PPT-Skills/templates/video_viewer.html` | 视频模板，与 PPT 无关 |
| `skills/NanoBanana-PPT-Skills/.env` | 密钥移至根 `.env` |
| `skills/NanoBanana-PPT-Skills/.env.example` | 密钥说明已合并 |
| `apps/web/src/lib/pptx-parser.ts` | 自定义 OOXML 解析器，已被 pptxviewjs 替代 |
| `apps/web/src/components/artifact/PptxPreviewCard.tsx` | pptx-preview + iframe 方案，导致全局黑屏 |
| `pptx-preview` npm dep | 闭源 PPTX 预览库，未使用 |
| `jquery` + `@types/jquery` npm deps | 为 PPTXjs（meshesha）方案安装，未实际使用 |

---

## 二、PPT 生成双路径

Agent 提供两种 PPT 生成方式，system prompt 推荐快速的 pptxgenjs：

| 方式 | 工具 | 速度 | 适用场景 |
|---|---|---|---|
| 程序化 PPTX（推荐） | pptxgenjs | 秒级 | 文本演示、常规报告 |
| AI 图示幻灯片 | Gemini API (`gemini-3-pro-image-preview`) | ~30秒/页 | 发布会、品牌展示 |

### 2.1 pptxgenjs 路径

```
Agent 用 pptxgenjs 生成 .pptx → 写入 workspace → 系统自动处理后续
```

### 2.2 Gemini AI 路径

```
Agent 创建 slides_plan.json → python generate_ppt.py --plan ... --style ... --resolution 2K
  → slide-*.png 图片 + index.html → 写入 workspace
```

**slides_plan.json 格式**：
```json
{
  "title": "演示文稿标题",
  "slides": [
    { "slide_number": 1, "page_type": "cover", "content": "标题\n副标题" },
    { "slide_number": 2, "page_type": "content", "content": "要点内容..." },
    { "slide_number": 3, "page_type": "data", "content": "数据总结" }
  ]
}
```

---

## 三、幻灯片预览方案（最终形态）

### 3.1 演进历程

| 阶段 | 方案 | 问题 |
|---|---|---|
| v1 | WebPreviewCard iframe（pptx_to_preview.py 生成的 HTML） | 依赖服务端 Python，内联预览不稳定 |
| v2 | 客户端 OOXML 解析器（JSZip + DOMParser） | 命名空间 bug、形状填充/边框/背景图未渲染 |
| v3 | pptx-preview npm 库 | 直接 DOM 操作导致全局黑屏 |
| v4 | ImageSlideshowCard + PptxViewerCard 双路径 | ✅ 当前方案 |

### 3.2 双路径架构

Gemini AI 生成路径（有 slide-*.png）和 pptxgenjs 路径（仅有 .pptx）走不同的预览通道：

```
Agent 生成 PPTX
  │
  ├─ Gemini AI 路径: 生成 slide-*.png + .pptx
  │     ↓
  │   shouldSkipFile 过滤 slide-*.png
  │     ↓
  │   服务端检测 2+ 张 slide 图片 → 合并为 slideshow artifact
  │     ↓
  │   InlineArtifactCard → type === "slideshow"
  │     → ImageSlideshowCard（PNG 轮播 + 翻页 UI）
  │
  └─ pptxgenjs 路径: 仅生成 .pptx
        ↓
      InlineArtifactCard → mimeType 匹配 presentation 或 .pptx 后缀
        → PptxViewerCard（pptxviewjs Canvas 渲染 + 翻页 UI）
```

### 3.3 PptxViewerCard（pptxviewjs）

基于 `pptxviewjs` npm 包的 Canvas 渲染查看器，与 `ImageSlideshowCard` 共享相同的翻页 UI：

- **渲染引擎**：`pptxviewjs`（Canvas 2D，支持图表/表格/媒体/SVG）
- **动态导入**：`await import("pptxviewjs")` — 按需加载，不阻塞应用启动（~910 KB chunk）
- **响应式尺寸**：`ResizeObserver` 监听容器宽度 → 动态设置 canvas 内部分辨率
- **真实宽高比**：从 PPTX 文件提取实际幻灯片尺寸（`processor.getSlideDimensions()`），自动适配 4:3 / 16:9 / 自定义比例
- **HiDPI 修复**：显式设置 CSS `width` + `height` 像素值，避免 `calculateCanvasRect` 落入 `devicePixelRatio` 分支导致尺寸错误
- **pnpm 兼容**：`vite.config.ts` 添加 `chart.js/auto` alias，解决 pnpm 严格模式下 optional peer dep 不链接的问题

**翻页 UI 特性**（与 ImageSlideshowCard 一致）：
- ⏮ ◀ N/M ▶ ⏭ 翻页按钮
- ●●● 圆点指示器（点击跳转）
- ⌨ 键盘导航（← → Home End）
- 👆 触摸滑动（50px 阈值）
- 🖱 点击左右 20% 边缘翻页
- 📥 ⬇ 下载按钮

### 3.4 ImageSlideshowCard

Gemini AI 路径的 PNG 轮播查看器：

```
shouldSkipFile 过滤 slide-*.png
  ↓
服务端检测 2+ 张 slide 图片 → 排序 → 复制到 data/artifacts/{id}/
  → 创建 type: "slideshow" artifact
  → metadataJson: { imageUrls: [...], slideCount: N }
  ↓
InlineArtifactCard 检测 type === "slideshow"
  → ImageSlideshowCard 渲染
```

### 3.5 shouldSkipFile 过滤规则

```
✅ 过滤（不广播、不创建 artifact）：
  - slide-*.png / slide-*.jpg / ...（任意目录）→ 合并为 slideshow
  - prompts.json / slides_plan.json（PPT 元数据）
  - *.js（PPT 辅助脚本）

✅ 放行：
  - .pptx                          → PptxViewerCard（Canvas 渲染）
  - index.html                     → WebPreviewCard
```

---

## 四、Agent QA 行为约束

### 4.1 问题

Agent 生成 PPT 后自发执行 QA：提取文本 → LibreOffice/PowerShell COM 导出图片 → spawn 子代理视觉审查 → 生成 QA 表格 → 修复后重新生成。整个过程使 PPT 生成时间翻倍。

### 4.2 迭代

| 版本 | 策略 | 效果 |
|---|---|---|
| v1 | 3 条笼统禁止（LibreOffice/COM/子代理） | ❌ Agent 绕过，自创文本提取、数学验证、QA 表格 |
| v2 | 7 条 ❌ 负面清单逐一列出观察到的 QA 套路 | ❌ 清单 = 操作建议，模型注意力被导向 QA 行为 |
| **v3** | **1 句正面约束 + 无条件注入 + system prompt 最开头** | ✅ 当前方案 |

### 4.3 v3 指令

**位置**：system prompt 第 1 行，在所有内容之前（含 history/cwd/agentConfig）

**内容**（1 句，无清单）：

```
⚠️ 核心规则：你的工作在文件写入磁盘的瞬间结束。不要读取、审查、检查、
验证或预览你生成的任何文件。系统会自动接管后续所有处理。审查文件 = 打断
系统流水线 = 浪费时间。生成 → 告知完成 → 停止。
```

**注入位置**：`claude-code.adapter.ts:89` / `codex.adapter.ts:84` — `CRITICAL_RULE` 常量，无条件注入（不依赖 `ppt/` 目录存在）

### 4.4 覆盖入口

| 入口 | 文件 | QA 约束 |
|---|---|---|
| 直接对话 → adapter | `claude-code.adapter.ts` | ✅ v3 |
| 直接对话 → adapter | `codex.adapter.ts` | ✅ v3 |
| `/NanoBanana-PPT-Skills` 技能 | `SKILL.md` | ✅ v3 |

---

## 五、已废弃的方案

### 5.1 pptx-parser.ts（已删除）

自定义 OOXML 解析器（JSZip + DOMParser），约 420 行。支持文本/图片/表格/填充/边框/背景。因渲染质量不理想且维护成本高，被 `pptxviewjs` 替代。

### 5.2 pptx-preview（已删除）

闭源 npm 库 `pptx-preview@1.0.7`，通过 iframe 隔离调用。直接操作 DOM 导致全局黑屏，无法使用。

### 5.3 PPTXjs / jQuery 方案（未采用）

基于 meshesha/PPTXjs 的 jQuery 插件方案，需要 jQuery + JSZip 全局注入。因 pptxviewjs 提供更现代的 Canvas 渲染和更好的 React 兼容性，未实际采用。

---

## 六、关键架构决策

| 决策 | 说明 |
|---|---|
| Agent 自主执行生成 | 无需新 API/WS 事件，复用 artifact pipeline |
| PPT 脚本放在 `AgentHub/ppt/` | 服务端永久资源，Agent 通过 CLI 调用 |
| 幻灯片预览 = 双路径 | Gemini 路径用 ImageSlideshowCard（PNG），pptxgenjs 路径用 PptxViewerCard（Canvas） |
| pptxviewjs 动态导入 | 按需加载 ~910 KB chunk，不阻塞应用启动 |
| `shouldSkipFile` 过滤 + 合并 | slide 图片不单独广播，合并为 slideshow artifact |
| `chart.js/auto` Vite alias | pnpm 严格模式下 pptxviewjs 的 optional peer dep 不链接，alias 到 `.pnpm` 存储路径 |
| Agent 禁止自审查 | v3 正面约束：1 句无条件注入在最开头，不列负面清单 |
| 环境变量集中管理 | 根 `.env` 统一管理 `GEMINI_API_KEY` |
| SKILL.md 精简 | 675→55 行，仅保留核心生成功能 |
| 新增 `slideshow` artifact 类型 | shared 包 5 处类型定义同步更新 |

---

## 七、验证结果

| 验证项 | 状态 |
|---|---|
| `python AgentHub/ppt/generate_ppt.py --help` | ✅ |
| `python AgentHub/ppt/pptx_to_preview.py --help` | ✅ |
| `.pptx` MIME type 映射 `application/vnd.openxmlformats-officedocument.presentationml.presentation` | ✅ |
| `shouldSkipFile` 过滤 slide 图片/metadata/JS | ✅ |
| Agent system prompt 中文输出注入 | ✅ |
| Agent system prompt PPT 生成指令 | ✅ |
| Agent QA v3 指令（无条件 + 开头注入） | ✅ |
| SKILL.md QA v3 同步 | ✅ |
| 服务端 slideshow artifact 合并逻辑 | ✅ |
| ImageSlideshowCard 翻页 UI（键盘/触摸/点击/圆点） | ✅ |
| InlineArtifactCard `type === "slideshow"` 路由 | ✅ |
| shared 类型 `"slideshow"` 5 处同步 | ✅ |
| TypeScript 编译 server + web | ✅ |
| PptxViewerCard Canvas 渲染（pptxgenjs 路径） | ✅ |
| PptxViewerCard 响应式尺寸 + 真实宽高比 | ✅ |
| PptxViewerCard 翻页 UI（键盘/触摸/点击/圆点） | ✅ |
| ImageSlideshowCard 翻页 UI（Gemini 路径） | ✅ |
| PptxViewerCard 下载按钮 | ✅ |
| 清理未使用代码（pptx-parser / PptxPreviewCard / pptx-preview / jquery） | ✅ |
| 端到端 PPT 预览 | ✅ |

---

## 八、Git 提交记录

| Commit | 说明 |
|---|---|
| `b37bbd9` | Feat: integrate NanoBanana PPT generator into AgentHub |
| `dc94f9a` | Fix: add .pptx MIME type + filter PPT internal files from artifacts |
| `3bf04b6` | Feat: inject Chinese language preference + PPT capability into agent system prompt |
| `af778dc` | Feat: add PPT presentation card in InlineArtifactCard |
| `2cfcf11` | Chore: add pptxgenjs dependency for programmatic PPT generation |
| `dbb92f0` | Fix: optimize PPT agent instructions + broaden slide image filter |
| `1162437` | Docs: add pptx_to_preview.py + Phase 5 completion doc + update todo |
| `c5887a4` | Chore: condense SKILL.md (675→105) + remove useless skill files |
| `ca9ac66` | Docs: merge Timeline into WorkOverview, rename to OVERVIEW.md |
| `27fe170` | Feat: client-side PPTX viewer using JSZip + DOMParser |
| `9880eb3` | Fix: PPT QA instructions v2 — 7 explicit prohibitions |
| `5e3cb90` | Docs: update Phase 5 completion + prune todo |
| `f01d0ef` | Feat: PPTX preview — switch to pptxviewjs (Canvas-based) for correct rendering |
| `66584d4` | Feat: add download button to PPTX viewer controls bar |
| *未提交* | Chore: remove unused PPTX code + update docs |
