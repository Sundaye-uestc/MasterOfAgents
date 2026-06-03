# Phase 5 开发完成文档

**完成日期：** 2026-06-03（更新：PPT 指令优化 + slide 过滤增强）

---

## 概述

Phase 5 的核心目标是将 NanoBanana PPT 生成能力集成到 AgentHub 中，使用户在聊天界面即可请求 Agent 生成 PPT，并通过 artifact pipeline 自动展示预览。同时完成了 agent 中文输出偏好注入、PPT 内部文件过滤、PPTX 到 HTML 预览转换、SKILL.md 精简、skills 目录清理，以及环境变量合并等工作。

---

## 一、PPT 生成脚本集成到 AgentHub

### 1.1 文件迁移

将 `skills/NanoBanana-PPT-Skills/` 核心文件复制到 `AgentHub/ppt/`，作为服务端永久资源：

```
AgentHub/ppt/
├── generate_ppt.py                  # 主生成脚本（适配后）
├── pptx_to_preview.py               # PPTX → HTML 预览转换器（新建）
├── .env.example                     # 环境变量参考
├── prompts/
│   └── transition_template.md       # 转场提示词模板
├── styles/
│   ├── gradient-glass.md            # 渐变毛玻璃风格
│   └── vector-illustration.md       # 矢量插画风格
└── templates/
    └── viewer.html                  # HTML 播放器模板
```

### 1.2 generate_ppt.py 适配

**文件：** `AgentHub/ppt/generate_ppt.py`（新建，510 行）

适配要点：
- 使用 `SCRIPTS_DIR = Path(__file__).parent.resolve()` 定位脚本目录，不再依赖 CWD
- 风格路径智能解析：支持完整路径、相对路径、简写名（如 `gradient-glass` → `styles/gradient-glass.md`）
- 失败时打印可用风格列表，方便 Agent 纠错
- 输出 JSON 结果块（`---RESULT---` / `---END RESULT---`），便于 Agent 解析

```python
def resolve_style_path(style_arg: str) -> Path:
    # 依次尝试：原样 → +.md → STYLES_DIR/name → STYLES_DIR/name.md
    # 全部失败时列出可用风格并退出
```

---

## 二、PPTX 到 HTML 预览转换器

### 2.1 pptx_to_preview.py

**文件：** `AgentHub/ppt/pptx_to_preview.py`（新建，525 行）

在服务端将 `.pptx` 文件转换为自包含的 HTML 幻灯片预览器，支持：

- **文本提取**：使用 python-pptx 遍历每张幻灯片的所有形状，提取段落文本、富文本格式（粗体、斜体、字号、颜色）、对齐方式
- **表格提取**：将 PPTX 表格渲染为 HTML `<table>`，带边框样式
- **图片提取**：从 PPTX ZIP 包中提取 `ppt/media/` 下的嵌入图片
- **位置保留**：EMU → px 转换，保持形状在幻灯片中的相对位置
- **HTML 播放器**：深色背景主题、淡入动画、键盘导航（←→ Home End）、触摸滑动、点击边缘翻页、圆点指示器

```
用法: python pptx_to_preview.py --input presentation.pptx --output preview_dir
```

### 2.2 服务端自动调用

**文件：** `AgentHub/apps/server/src/services/agent-runtime.service.ts`（修改）

在 artifact 创建循环后，检测 `.pptx` / `.ppt` 文件变更，自动运行 `pptx_to_preview.py`：

```typescript
// 检测 PPTX 变更
const pptxChanges = changes.filter(c => {
  const ext = path.extname(c.path).toLowerCase();
  return [".pptx", ".ppt"].includes(ext) && c.changeType !== "delete";
});

// 依次处理：运行 python 脚本 → 复制预览目录到 data/artifacts/{id}/
// → 创建 webpage 类型 artifact → broadcast artifact:created
```

---

## 三、Artifact Pipeline 增强

### 3.1 PPTX MIME 类型映射

在 `agent-runtime.service.ts` 扩展名→MIME 映射中新增：

```typescript
} else if ([".pptx", ".ppt"].includes(ext)) {
  mimeType = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
}
```

### 3.2 PPT 内部文件过滤（shouldSkipFile）

**问题**：PPT 生成过程产生数百个文件（slide 图片、metadata JSON、JS 脚本），每个都触发 file:changed 广播和 artifact 创建，严重污染聊天 UI。

**方案**：新增 `shouldSkipFile` 过滤器，跳过以下文件：

| 过滤规则 | 匹配模式 | 说明 |
|---|---|---|
| 幻灯片图片 | `/images/slide-\d+\.(png\|jpg\|jpeg\|webp)$` | 每页一张，最多数十张 |
| 元数据 JSON | `/(prompts\|slides_plan)\.json$` | 生成过程的内部记录 |
| JS 脚本 | `/\.js$` | 生成过程中创建的辅助脚本 |

被跳过的文件不会触发 `file:changed` 广播，也不会创建 artifact。用户只看到最终产物（PPX 文件 + HTML 预览）。

### 3.3 PPTX 预览作为 Webpage Artifact

PPTX 预览 HTML 被创建为 `type: "webpage"` 的 artifact，前端 `InlineArtifactCard` 将其路由到 `WebPreviewCard`（可折叠 iframe），实现与普通 HTML 文件一致的内联预览体验。

---

## 四、Agent System Prompt 增强

### 4.1 中文输出偏好

**文件：** `apps/server/src/adapters/claude-code.adapter.ts`、`codex.adapter.ts`

在 system prompt 中注入中文语言指令，确保 Agent 始终使用中文思考和回复：

```typescript
const cwdBlock = `\n当前工作目录: ${cwd}\n请将所有新建/修改的文件放在此目录下...\n请始终使用中文进行思考和回复，包括工具调用中的描述文本和文件内容（代码和配置文件除外）。`;
```

### 4.2 PPT 生成能力指令

同样的两个 adapter 文件中，自动检测 `AgentHub/ppt/generate_ppt.py` 存在后，注入 PPT 生成指南：

```
## PPT 生成能力

你可以为用户生成 PPT。方法如下：
1. 规划内容 → slides_plan.json（cover / content / data 页面类型）
2. 执行生成 → python AgentHub/ppt/generate_ppt.py --plan ... --style ... --resolution ...
3. 返回结果 → index.html 预览页面 + images/

可用风格: gradient-glass (科技商务), vector-illustration (教育培训)
分辨率: 2K (2752×1536，推荐), 4K (5504×3072)
生成耗时约 30 秒/页
```

---

## 五、前端 PPT 展示

### 5.1 InlineArtifactCard 分发

**文件：** `apps/web/src/components/chat/InlineArtifactCard.tsx`（修改）

新增 `isPresentation()` 检测函数 + PPT 下载卡片，分发顺序更新为：

```
webpage → image → text → presentation → download fallback
```

PPT 卡片展示：
- 📊 图标 + 文件名 + "PPT 演示文稿" 标签
- 橙色下载按钮（`bg-orange-600`）

```typescript
function isPresentation(mimeType: string | null): boolean {
  if (!mimeType) return false;
  return mimeType.includes("presentation") ||
    mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    mimeType === "application/vnd.ms-powerpoint";
}
```

### 5.2 PPTX 内联预览

由于 PPTX 已被 `pptx_to_preview.py` 转换为 HTML 预览并创建为 `type: "webpage"` 的 artifact，前端通过 `WebPreviewCard`（可折叠 iframe）自然展示。用户可在聊天界面直接翻页浏览 PPT，无需下载。

---

## 六、SKILL.md 精简

### 6.1 修改内容

**文件：** `skills/NanoBanana-PPT-Skills/SKILL.md`（修改）

- **前**：675 行，包含大量冗余说明、详细示例、开发文档
- **后**：~105 行，保留核心生成功能和必要美观度

保留内容：
- 快速开始（4 步：确认需求 → 生成 slides_plan.json → 执行生成 → 返回结果）
- slides_plan.json 格式规范（page_type: cover / content / data）
- 命令参数参考表（`--plan` / `--style` / `--resolution` / `--output`）
- 两种风格简介（gradient-glass / vector-illustration，各 2-3 行）
- 环境要求（GEMINI_API_KEY + Python 依赖）
- 输出结构
- 3 条常见问题

移除内容：
- 冗长的风格详细描述（原始 ~50 行 → 精简为 2-3 行/风格）
- 重复的 API key 配置说明
- 开发注意事项
- 版本历史

---

## 七、Skills 目录清理

### 7.1 删除文件清单

| 文件 | 删除原因 |
|---|---|
| `README.md`（871 行）| 开发文档，对 PPT 生成功能无用，内容已在 SKILL.md 中覆盖 |
| `prompt_file_reader.py`（117 行）| 视频功能辅助脚本，与 PPT 生成无关 |
| `templates/video_viewer.html`（437 行）| 视频播放器模板，与 PPT 生成无关 |
| `.env` | 真实密钥已移至根目录 `.env` |
| `.env.example`（109 行）| 密钥说明已合并到根目录，AgentHub/ppt/ 保留一份参考 |

### 7.2 清理后目录结构

```
skills/NanoBanana-PPT-Skills/
├── SKILL.md                  # 精简后的核心文档
├── generate_ppt.py           # 生成脚本（参考用途）
├── prompts/
│   └── transition_template.md
├── styles/
│   ├── gradient-glass.md
│   └── vector-illustration.md
└── templates/
    └── viewer.html
```

---

## 八、环境配置

### 8.1 API Key 合并

从 `skills/NanoBanana-PPT-Skills/.env` 提取 `GEMINI_API_KEY` 合并到根目录 `.env`：

```env
GEMINI_API_KEY=REDACTED
```

同时预留了 Kling（可灵 AI）密钥占位符，供后续视频功能使用。

### 8.2 依赖补充

**Python**（`requirements.txt`）：
```
python-dotenv>=1.0.0
```

**Node.js**（`package.json`）：
```
"pptxgenjs": "^4.0.1"
```

---

## 十、Agent PPT 生成行为优化（2026-06-03）

### 10.1 问题现象

Agent 在用 pptxgenjs 生成 PPTX 后，会自发执行一系列不必要的 QA 步骤：
- 尝试安装/使用 LibreOffice 将 PPTX 导出为图片
- 回退到 PowerShell COM 对象做图片导出
- 启动子代理（sub-agent）做视觉审查
- 根据审查结果微调 spacing/布局后重新生成

这些步骤每次耗费数分钟且完全多余——服务端 artifact pipeline 已自动将 PPTX 转为 HTML 预览供用户查看。

### 10.2 修复方案

**文件：** `apps/server/src/adapters/claude-code.adapter.ts`、`codex.adapter.ts`

重写 PPT 生成指令块，新增：

- **方式一（AI 图示幻灯片）** vs **方式二（程序化 PPTX）** 的明确区分
- **⚠️ 重要约束**段落：
  - 绝对禁止安装/使用 LibreOffice
  - 绝对禁止使用 PowerShell COM 对象导出图片
  - 绝对禁止子代理视觉审查
  - 生成后仅需验证文件存在且 >1KB，直接告知用户结果
  - 如有小问题用户会自行反馈，无需预先修复

### 10.3 slide 图片过滤增强

**文件：** `apps/server/src/services/agent-runtime.service.ts`

**问题**：`shouldSkipFile` 的 slide 图片正则 `/\/images\/slide-\d+\.(png|jpg|jpeg|webp)$/i` 仅匹配 `images/` 子目录下的文件。Agent 在根目录直接生成的 `slide.jpg` 等文件未被过滤，仍出现在聊天 UI 中。

**修复**：将正则改为 `/(^|\/)slide-?\d*\.(png|jpg|jpeg|webp)$/i`，匹配任意目录下的 slide 图片：

| 文件路径 | 旧规则 | 新规则 |
|---|---|---|
| `images/slide-01.png` | ✅ 过滤 | ✅ 过滤 |
| `slide.jpg` | ❌ 漏过 | ✅ 过滤 |
| `slide-1.png` | ❌ 漏过 | ✅ 过滤 |
| `slide01.webp` | ❌ 漏过 | ✅ 过滤 |

---

## 十一、修改文件汇总（更新）

| 文件 | 动作 | 说明 |
|---|---|---|
| `AgentHub/ppt/generate_ppt.py` | 新建 | 主 PPT 生成脚本（适配路径解析） |
| `AgentHub/ppt/pptx_to_preview.py` | 新建 | PPTX → HTML 预览转换器 |
| `AgentHub/ppt/styles/gradient-glass.md` | 新建 | 渐变毛玻璃风格模板 |
| `AgentHub/ppt/styles/vector-illustration.md` | 新建 | 矢量插画风格模板 |
| `AgentHub/ppt/prompts/transition_template.md` | 新建 | 转场提示词模板 |
| `AgentHub/ppt/templates/viewer.html` | 新建 | HTML 播放器模板 |
| `AgentHub/ppt/.env.example` | 新建 | 环境变量参考 |
| `apps/server/src/services/agent-runtime.service.ts` | 修改 | MIME 映射 + shouldSkipFile（含 slide 图片过滤增强）+ PPTX 预览生成 |
| `apps/server/src/adapters/claude-code.adapter.ts` | 修改 | 中文指令 + PPT 能力注入 + PPT 行为约束（禁止 LibreOffice/COM/子代理审查） |
| `apps/server/src/adapters/codex.adapter.ts` | 修改 | 中文指令 + PPT 能力注入 + PPT 行为约束（禁止 LibreOffice/COM/子代理审查） |
| `apps/web/src/components/chat/InlineArtifactCard.tsx` | 修改 | isPresentation() + PPT 下载卡片 |
| `skills/NanoBanana-PPT-Skills/SKILL.md` | 修改 | 精简 675→105 行 |
| `skills/NanoBanana-PPT-Skills/README.md` | 删除 | 无用文档 |
| `skills/NanoBanana-PPT-Skills/prompt_file_reader.py` | 删除 | 视频功能脚本 |
| `skills/NanoBanana-PPT-Skills/templates/video_viewer.html` | 删除 | 视频播放器模板 |
| `skills/NanoBanana-PPT-Skills/.env` | 删除 | 密钥已合并到根目录 |
| `skills/NanoBanana-PPT-Skills/.env.example` | 删除 | 密钥说明已合并 |
| `.env`（根目录） | 修改 | 添加 GEMINI_API_KEY + Kling 占位 |
| `requirements.txt` | 修改 | 添加 python-dotenv |
| `package.json` | 修改 | 添加 pptxgenjs 依赖 |

---

## 关键架构决策

| 决策 | 说明 |
|---|---|
| Agent 自主执行 PPT 生成 | 无需新增 API/WS 事件，复用现有 artifact pipeline |
| PPTX 服务端转 HTML 预览 | 前端无需支持 PPTX 渲染，复用 WebPreviewCard iframe |
| shouldSkipFile 过滤 | 幻灯片图片（任意目录）、元数据 JSON、JS 脚本不触发广播和 artifact |
| PPT 生成脚本放置于 AgentHub/ppt/ | 作为服务端永久资源，Agent 通过 CLI 调用 |
| 禁止 Agent 自审查 | PPT 指令中明确禁止 LibreOffice/COM/子代理视觉审查，由服务端 artifact pipeline 自动生成预览 |
| 精简 SKILL.md | 从 675 行砍至 105 行，核心生成功能 + 必要美观度 |
| 环境变量集中管理 | 根目录 .env 统一管理所有 API 密钥 |

---

## 验证结果

- `python AgentHub/ppt/generate_ppt.py --help` ✅ 正常输出帮助
- `python AgentHub/ppt/pptx_to_preview.py --help` ✅ 正常输出帮助
- Agent system prompt 包含中文指令 ✅ （两个 adapter 均已注入）
- Agent system prompt 包含 PPT 生成能力说明 ✅
- `.pptx` MIME type 映射正确 ✅
- `shouldSkipFile` 过滤生效 ✅ （幻灯片图片 + metadata JSON + JS 脚本）
- slide 图片过滤增强 ✅ （根目录 `slide.jpg`、`slide-1.png` 等均可拦截）
- Agent PPT 指令含 LibreOffice/COM/子代理审查禁止 ✅
- `InlineArtifactCard` PPT 下载卡片显示 ✅
- PPTX 预览 HTML 作为 webpage artifact 创建 ✅
- SKILL.md 精简完成 ✅ （675→105 行）
- skills/ 目录清理完成 ✅ （仅保留 6 个核心文件）
- GEMINI_API_KEY 已配置到根 .env ✅
- TypeScript 编译：server ✅ / web ✅

---

## Git 提交记录

| Commit | 说明 |
|---|---|
| `b37bbd9` | Feat: integrate NanoBanana PPT generator into AgentHub |
| `dc94f9a` | Fix: add .pptx MIME type + filter PPT internal files from artifacts |
| `3bf04b6` | Feat: inject Chinese language preference + PPT capability into agent system prompt |
| `af778dc` | Feat: add PPT presentation card in InlineArtifactCard |
| `2cfcf11` | Chore: add pptxgenjs dependency for programmatic PPT generation |

另有部分工作（pptx_to_preview.py、SKILL.md 精简、skills 目录清理、.env 合并）尚未提交，位于当前工作目录。
