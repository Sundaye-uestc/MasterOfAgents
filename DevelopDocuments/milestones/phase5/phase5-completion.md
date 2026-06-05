# Phase 5 开发完成文档

**完成日期：** 2026-06-04

---

## 概述

Phase 5 将 NanoBanana PPT 生成能力集成到 AgentHub，用户通过聊天即可请求 Agent 生成 PPT。

- **PPT 生成**：Agent 用 pptxgenjs（秒级）或 Gemini AI（视觉丰富）生成 .pptx 文件
- **PPTX 预览**：双路径 — `ImageSlideshowCard`（Gemini 路径，slide 图片轮播）+ `PptxViewerCard`（pptxgenjs 路径，pptxviewjs Canvas 渲染）
- **Agent 行为约束**：正面约束指令，阻止 Agent 在生成后自我审查

---

## 一、文件清单

### 1.1 新建文件

| 文件 | 说明 |
|---|---|
| `AgentHub/ppt/generate_ppt.py` | AI 图示幻灯片生成（Gemini API） |
| `AgentHub/ppt/pptx_to_preview.py` | PPTX → 自包含 HTML 预览（python-pptx，备用） |
| `AgentHub/ppt/styles/gradient-glass.md` | 渐变毛玻璃科技商务风格 |
| `AgentHub/ppt/styles/vector-illustration.md` | 矢量插画教育培训风格 |
| `AgentHub/ppt/prompts/transition_template.md` | 转场提示词模板 |
| `AgentHub/ppt/templates/viewer.html` | HTML 播放器模板 |
| `AgentHub/ppt/.env.example` | 环境变量参考 |
| `apps/web/src/components/artifact/PptxViewerCard.tsx` | pptxviewjs Canvas 渲染查看器 |
| `apps/web/src/components/artifact/ImageSlideshowCard.tsx` | slide 图片轮播组件 |

### 1.2 修改文件

| 文件 | 说明 |
|---|---|
| `apps/server/src/adapters/claude-code.adapter.ts` | 中文输出 + PPT 生成指令 + QA 约束 |
| `apps/server/src/adapters/codex.adapter.ts` | 同上 |
| `apps/server/src/services/agent-runtime.service.ts` | MIME 映射 + shouldSkipFile 过滤 + PPTX→HTML 自动转换 + slideshow artifact 合并 |
| `apps/web/src/components/chat/InlineArtifactCard.tsx` | slideshow 路由 → ImageSlideshowCard；PPTX 路由 → PptxViewerCard |
| `apps/web/vite.config.ts` | chart.js/auto alias（pnpm 严格模式兼容） |
| `skills/NanoBanana-PPT-Skills/SKILL.md` | 精简 675→55 行 + QA 约束 |
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
| `skills/NanoBanana-PPT-Skills/README.md` | 冗余文档 |
| `skills/NanoBanana-PPT-Skills/prompt_file_reader.py` | 视频脚本，与 PPT 无关 |
| `skills/NanoBanana-PPT-Skills/templates/video_viewer.html` | 视频模板，与 PPT 无关 |
| `skills/NanoBanana-PPT-Skills/.env` + `.env.example` | 密钥移至根目录 |
| `apps/web/src/lib/pptx-parser.ts` | 自定义 OOXML 解析器，已被 pptxviewjs 替代 |
| `apps/web/src/components/artifact/PptxPreviewCard.tsx` | 已废弃，被 PptxViewerCard 替代 |
| `pptx-preview` / `jquery` npm deps | 未使用 |

---

## 二、PPT 生成双路径

| 方式 | 工具 | 速度 | 适用场景 |
|---|---|---|---|
| 程序化 PPTX（推荐） | pptxgenjs | 秒级 | 文本演示、常规报告 |
| AI 图示幻灯片 | Gemini API (`gemini-3-pro-image-preview`) | ~30秒/页 | 发布会、品牌展示 |

### 2.1 pptxgenjs 路径

```
Agent 用 pptxgenjs 生成 .pptx → 写入 workspace → 系统自动创建 artifact + 预览
```

### 2.2 Gemini AI 路径

```
Agent 创建 slides_plan.json → python generate_ppt.py
  → slide-*.png + index.html → 写入 workspace
```

**slides_plan.json 格式**：
```json
{
  "title": "演示文稿标题",
  "slides": [
    { "slide_number": 1, "page_type": "cover", "content": "标题\n副标题" },
    { "slide_number": 2, "page_type": "content", "content": "要点内容..." }
  ]
}
```

---

## 三、幻灯片预览

### 3.1 双路径架构

```
Agent 生成 PPTX
  │
  ├─ Gemini AI 路径: 生成 slide-*.png + .pptx
  │     ↓
  │   服务端检测 2+ 张 slide 图片 → 合并为 slideshow artifact
  │     ↓
  │   InlineArtifactCard → ImageSlideshowCard（PNG 轮播）
  │
  └─ pptxgenjs 路径: 仅生成 .pptx
        ↓
      InlineArtifactCard → PptxViewerCard（Canvas 渲染）
```

### 3.2 PptxViewerCard

基于 `pptxviewjs`（Canvas 2D），动态导入按需加载。支持图表/表格/媒体/SVG 渲染，自动适配 4:3 / 16:9 / 自定义宽高比，ResizeObserver 响应式尺寸。

**翻页 UI**：⏮ ◀ N/M ▶ ⏭ 按钮 · ●●● 圆点指示器 · ⌨ 键盘导航 · 👆 触摸滑动 · 🖱 点击边缘翻页 · ⬇ 下载

### 3.3 ImageSlideshowCard

Gemini AI 路径的 PNG 轮播查看器。服务端检测 2+ 张 slide 图片 → 排序 → 复制到 artifact 缓存 → 创建 `type: "slideshow"` artifact（`metadataJson` 含 `imageUrls` + `slideCount`）。翻页 UI 与 PptxViewerCard 一致。

### 3.4 shouldSkipFile 过滤规则

```
✅ 过滤（不广播、不创建独立 artifact）：
  - slide-*.png / slide-*.jpg / ... → 合并为 slideshow
  - prompts.json / slides_plan.json（PPT 元数据）
  - *.js（PPT 辅助脚本）

✅ 放行：
  - .pptx → PptxViewerCard
  - index.html → WebPreviewCard
```

---

## 四、Agent QA 行为约束

Agent 生成 PPT 后会自发执行 QA（提取文本、导出图片、spawn 子代理视觉审查），使生成时间翻倍。

**最终方案**：system prompt 第 1 行注入正面约束（1 句，不列负面清单），无条件生效：

```
⚠️ 核心规则：你的工作在文件写入磁盘的瞬间结束。不要读取、审查、检查、
验证或预览你生成的任何文件。系统会自动接管后续所有处理。审查文件 = 打断
系统流水线 = 浪费时间。生成 → 告知完成 → 停止。
```

覆盖入口：`claude-code.adapter.ts` / `codex.adapter.ts` / `SKILL.md`。

---

## 五、关键架构决策

| 决策 | 说明 |
|---|---|
| Agent 自主执行生成 | 无需新 API/WS 事件，复用 artifact pipeline |
| PPT 脚本放在 `AgentHub/ppt/` | 服务端永久资源，Agent 通过 CLI 调用 |
| 幻灯片预览双路径 | Gemini → ImageSlideshowCard（PNG），pptxgenjs → PptxViewerCard（Canvas） |
| `shouldSkipFile` 过滤 + 合并 | slide 图片不单独广播，合并为 slideshow artifact |
| 新增 `slideshow` artifact 类型 | shared 包 5 处类型定义同步更新 |
| Agent 禁止自审查 | 正面约束，1 句无条件注入在最开头 |
| SKILL.md 精简 | 675→55 行，仅保留核心生成功能 |

---

## 六、验证结果

| 验证项 | 状态 |
|---|---|
| `python AgentHub/ppt/generate_ppt.py --help` | ✅ |
| `python AgentHub/ppt/pptx_to_preview.py --help` | ✅ |
| `.pptx` MIME type 映射 | ✅ |
| `shouldSkipFile` 过滤 | ✅ |
| Agent system prompt（中文 + PPT 指令 + QA 约束） | ✅ |
| 服务端 slideshow artifact 合并 | ✅ |
| ImageSlideshowCard 翻页 UI | ✅ |
| PptxViewerCard Canvas 渲染 + 响应式 + 翻页 UI | ✅ |
| InlineArtifactCard slideshow / PPTX 路由 | ✅ |
| TypeScript 编译 server + web | ✅ |
| 端到端 PPT 预览 | ✅ |
| 多 Agent 并发无重复 artifact | ✅ |
| 浅色/深色主题适配 | ✅ |

---

## 七、Git 提交记录

| Commit | 说明 |
|---|---|
| `b37bbd9` | Feat: integrate NanoBanana PPT generator into AgentHub |
| `dc94f9a` | Fix: add .pptx MIME type + filter PPT internal files from artifacts |
| `3bf04b6` | Feat: inject Chinese language preference + PPT capability into agent system prompt |
| `af778dc` | Feat: add PPT presentation card in InlineArtifactCard |
| `2cfcf11` | Chore: add pptxgenjs dependency |
| `dbb92f0` | Fix: optimize PPT agent instructions + broaden slide image filter |
| `1162437` | Docs: add pptx_to_preview.py + Phase 5 completion doc |
| `c5887a4` | Chore: condense SKILL.md + remove useless skill files |
| `ca9ac66` | Docs: merge Timeline into WorkOverview |
| `27fe170` | Feat: client-side PPTX viewer using JSZip + DOMParser |
| `9880eb3` | Fix: PPT QA instructions v2 |
| `5e3cb90` | Docs: update Phase 5 completion |
| `f01d0ef` | Feat: PPTX preview — switch to pptxviewjs (Canvas-based) |
| `66584d4` | Feat: add download button to PPTX viewer controls bar |
| `89a0d6b` | Fix: merge wip PPT preview fixes into zyw + dark mode adaptation |
| `0644527` | Merge PR #1: light/dark theme + ChatGPT-style UI redesign + snapshot improvements |
| *未提交* | Fix: multi-agent duplicate artifact display (cross-run dedup by name) |

---

## 下一步

PPT 生成与预览已稳定，后续将聚焦 Agent 平台能力完善。工作项：
1. Codex CLI 安装与端到端验证 — 当前 CodexAdapter 代码已完成，CLI 环境就绪后即可启用
2. 用户自建 Agent — 对话式创建 + 自定义 System Prompt + 工具集配置 + Agent 管理界面
3. SSH 推送 — 从 HTTPS + schannel + proxy 迁移到 SSH key 直连
