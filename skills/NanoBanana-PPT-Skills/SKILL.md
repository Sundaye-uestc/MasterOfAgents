# PPT Generator

基于 AI 自动生成高质量 PPT 幻灯片图片，使用 Nano Banana (Gemini) 生成 16:9 高清幻灯片，输出 HTML 播放器。

## 快速开始

用户提供内容后，按以下步骤执行：

### 1. 确认需求

询问用户：风格（默认 gradient-glass）、页数（默认 5-7 页）、分辨率（默认 2K）。

### 2. 生成 slides_plan.json

根据用户内容规划幻灯片，创建 `slides_plan.json`：

```json
{
  "title": "演示文稿标题",
  "slides": [
    {
      "slide_number": 1,
      "page_type": "cover",
      "content": "标题\n副标题"
    },
    {
      "slide_number": 2,
      "page_type": "content",
      "content": "要点一：...\n要点二：..."
    },
    {
      "slide_number": 3,
      "page_type": "data",
      "content": "数据展示内容"
    }
  ]
}
```

**page_type**：`cover`（封面）、`content`（内容页）、`data`（数据/总结页）

**页数参考**：5 页适合短演讲，5-10 页适合常规演示，10-15 页适合详细报告。

### 3. 执行生成

```bash
python AgentHub/ppt/generate_ppt.py \
  --plan slides_plan.json \
  --style gradient-glass \
  --resolution 2K \
  --output ppt_output
```

**参数说明**：

| 参数 | 说明 |
|---|---|
| `--plan` | slides_plan.json 路径 |
| `--style` | `gradient-glass`（科技商务）或 `vector-illustration`（教育培训） |
| `--resolution` | `2K`（2752x1536，推荐）或 `4K`（5504x3072） |
| `--output` | 输出目录（默认 `ppt_output/时间戳`） |

每页约需 30 秒，生成过程中会输出进度。

### 4. 返回结果

生成完成后告知用户：
- 播放器页面：`ppt_output/index.html`
- 幻灯片图片：`ppt_output/images/`
- 在 AgentHub 中，HTML 页面会自动以内联预览卡片展示

## 风格

**gradient-glass**（渐变毛玻璃卡片）
Apple Keynote 极简风格，玻璃拟态、霓虹紫/电光蓝/珊瑚橙渐变，3D 玻璃物体 + 电影级光照。适合科技发布、商务演示、数据报告。

**vector-illustration**（矢量插画）
扁平化矢量设计，统一黑色轮廓线，复古柔和配色。适合教育培训、创意提案、品牌故事。

自定义风格：在 `styles/` 目录创建 `.md` 文件即可。

## 环境要求

- `GEMINI_API_KEY`：必需，[获取地址](https://aistudio.google.com/apikey)，每天 15 次免费请求
- Python 依赖：`pip install google-genai pillow python-dotenv`
- 视频功能（可选）：需配置可灵 AI 密钥 + FFmpeg，参见 `README.md`

## 输出结构

```
ppt_output/
├── index.html      # HTML 幻灯片播放器（键盘翻页、触摸滑动）
├── images/
│   ├── slide-01.png
│   ├── slide-02.png
│   └── ...
└── prompts.json    # 提示词记录
```

## 常见问题

- **API 密钥未设置**：在 `AgentHub/.env` 或项目根目录 `.env` 中设置 `GEMINI_API_KEY`
- **依赖缺失**：`pip install google-genai pillow python-dotenv`
- **生成失败**：检查网络连接和 API 密钥有效性，稍后重试
