# PPT Generator

⚠️ 核心规则：文件写入磁盘的瞬间你的工作就结束了。不要读取、审查、检查、验证或预览生成的任何文件。系统会自动接管后续所有处理。生成 → 告知完成 → 停止。

## 快速开始

**快速方式（推荐）**：pptxgenjs 直接生成 .pptx，秒级完成。

**视觉方式**（需要精美视觉效果时）：
```bash
python AgentHub/ppt/generate_ppt.py \
  --plan slides_plan.json \
  --style gradient-glass \
  --resolution 2K \
  --output ppt_output
```

## slides_plan.json 格式

```json
{
  "title": "演示文稿标题",
  "slides": [
    { "slide_number": 1, "page_type": "cover", "content": "标题\n副标题" },
    { "slide_number": 2, "page_type": "content", "content": "要点内容..." },
    { "slide_number": 3, "page_type": "data", "content": "数据/总结" }
  ]
}
```

默认 5-7 页，2K 分辨率。

## 风格 & 参数

| 风格 | 适用场景 |
|---|---|
| `gradient-glass` | 科技发布、商务演示、数据报告 |
| `vector-illustration` | 教育培训、创意提案、品牌故事 |

| 参数 | 值 |
|---|---|
| `--resolution` | `2K`（推荐，快）或 `4K`（慢） |
| `--output` | 输出目录，默认 `ppt_output/时间戳` |

## 输出结构

```
ppt_output/
├── index.html      # HTML 播放器（自动内联预览）
├── images/         # 幻灯片图片
└── prompts.json    # 提示词记录
```

## 环境要求

- `GEMINI_API_KEY`：[获取](https://aistudio.google.com/apikey)，每天 15 次免费请求
- Python 依赖：`pip install google-genai pillow python-dotenv`
