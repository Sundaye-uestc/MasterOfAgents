// ============================================================
// Tool Set definitions — 10 predefined capability bundles
// Used by agent-builder for LLM auto-matching and frontend display
// ============================================================

export interface ToolSet {
  id: string;
  label: string;
  icon: string;
  description: string;
  /** Capability tags associated with this tool set */
  capabilities: string[];
  /** Keywords for LLM/heuristic matching from user descriptions */
  matchKeywords: string[];
  /** Prompt snippet injected into agent system prompt */
  promptSnippet: string;
}

export const TOOL_SETS: ToolSet[] = [
  {
    id: "ppt",
    label: "PPT 生成",
    icon: "📊",
    description: "使用 pptxgenjs 或 Gemini AI 生成专业演示文稿幻灯片",
    capabilities: ["ppt-generation", "slideshow", "presentation"],
    matchKeywords: ["ppt", "幻灯片", "演示", "presentation", "slides", "讲稿", "报告", "路演"],
    promptSnippet:
      "你擅长生成 PPT 演示文稿。可以使用 pptxgenjs 快速生成 .pptx 文件，或使用 Gemini AI 生成视觉丰富的幻灯片图片。",
  },
  {
    id: "docs",
    label: "文档撰写",
    icon: "📝",
    description: "撰写 Markdown、技术文档、README、API 文档等",
    capabilities: ["documentation", "writing", "markdown"],
    matchKeywords: ["文档", "doc", "文档撰写", "README", "markdown", "技术文档", "API文档", "说明", "手册", "博客", "文章"],
    promptSnippet:
      "你擅长撰写各类技术文档，包括 Markdown 文档、README、API 文档、技术说明和博客文章。",
  },
  {
    id: "data",
    label: "数据分析",
    icon: "📈",
    description: "数据处理、可视化图表、统计分析、报表生成",
    capabilities: ["data-analysis", "visualization", "charting", "statistics"],
    matchKeywords: ["数据", "data", "分析", "图表", "chart", "统计", "可视化", "报表", "excel", "csv", "json", "sql", "清洗", "处理"],
    promptSnippet:
      "你擅长数据分析和可视化。可以处理 CSV/JSON/Excel 数据，生成统计报表和可视化图表。",
  },
  {
    id: "frontend",
    label: "前端开发",
    icon: "🎨",
    description: "HTML/CSS/JavaScript/React/Vue 前端页面与组件开发",
    capabilities: ["frontend", "html", "css", "javascript", "react", "vue", "ui"],
    matchKeywords: ["前端", "frontend", "页面", "UI", "界面", "html", "css", "js", "react", "vue", "组件", "样式", "响应式", "web"],
    promptSnippet:
      "你擅长前端开发，包括 HTML/CSS/JavaScript、React、Vue 等框架，能创建响应式页面和交互组件。",
  },
  {
    id: "backend",
    label: "后端开发",
    icon: "⚙️",
    description: "Node.js/Python/Go API 服务开发、数据库设计",
    capabilities: ["backend", "api", "database", "server", "nodejs", "python", "go"],
    matchKeywords: ["后端", "backend", "API", "服务", "server", "数据库", "database", "node", "python", "go", "接口", "REST", "sql", "中间件"],
    promptSnippet:
      "你擅长后端开发，包括 Node.js/Python/Go API 服务开发、数据库设计和中间件架构。",
  },
  {
    id: "debug",
    label: "代码调试",
    icon: "🐛",
    description: "错误定位、日志分析、性能诊断、修复建议",
    capabilities: ["debugging", "troubleshooting", "error-analysis", "performance"],
    matchKeywords: ["调试", "debug", "bug", "错误", "error", "修复", "fix", "排错", "排查", "日志", "log", "报错", "异常", "崩溃", "crash", "性能", "慢"],
    promptSnippet:
      "你擅长代码调试和问题排查。能快速定位错误根因、分析日志、诊断性能瓶颈并提供修复方案。",
  },
  {
    id: "file",
    label: "文件管理",
    icon: "📁",
    description: "批量重命名、格式转换、文件搜索、目录整理",
    capabilities: ["file-management", "file-operations", "batch-processing"],
    matchKeywords: ["文件", "file", "批量", "重命名", "搜索", "查找", "转换", "格式", "目录", "整理", "复制", "移动", "删除", "压缩", "解压"],
    promptSnippet:
      "你擅长文件系统操作，包括批量重命名、格式转换、文件搜索和目录整理。",
  },
  {
    id: "search",
    label: "网络搜索",
    icon: "🔍",
    description: "信息检索、网页内容抓取、知识查询",
    capabilities: ["web-search", "information-retrieval", "research"],
    matchKeywords: ["搜索", "search", "检索", "查找", "查询", "网络", "web", "信息", "资料", "研究", "调研", "爬取", "抓取"],
    promptSnippet:
      "你擅长网络信息检索和知识查询。可以搜索最新资料、抓取网页内容并进行信息整合。",
  },
  {
    id: "test",
    label: "测试编写",
    icon: "🧪",
    description: "单元测试、集成测试、端到端测试、覆盖率分析",
    capabilities: ["testing", "unit-test", "integration-test", "e2e-test", "coverage"],
    matchKeywords: ["测试", "test", "单元测试", "集成测试", "用例", "覆盖率", "coverage", "jest", "pytest", "mocha", "TDD", "断言", "mock"],
    promptSnippet:
      "你擅长编写各类测试用例，包括单元测试、集成测试和端到端测试，关注代码覆盖率和边界情况。",
  },
  {
    id: "security",
    label: "安全审查",
    icon: "🔒",
    description: "漏洞扫描、依赖安全检查、代码审计",
    capabilities: ["security", "vulnerability", "audit", "dependency-check"],
    matchKeywords: ["安全", "security", "漏洞", "审计", "audit", "扫描", "scan", "依赖", "加密", "认证", "权限", "注入", "XSS", "CSRF", "SQL注入"],
    promptSnippet:
      "你擅长安全审查和代码审计。可以扫描漏洞、检查依赖安全、审查认证和授权逻辑。",
  },
];

/** Get tool set by ID */
export function getToolSetById(id: string): ToolSet | undefined {
  return TOOL_SETS.find((ts) => ts.id === id);
}

/** Generate prompt injection text for a set of tool set IDs */
export function getToolSetPromptInjection(toolSetIds: string[]): string {
  if (toolSetIds.length === 0) return "";

  const lines: string[] = ["\n\n【工具集配置】", "该 Agent 已配置以下专业领域能力："];

  for (const id of toolSetIds) {
    const ts = getToolSetById(id);
    if (ts) {
      lines.push(`- ${ts.icon} ${ts.label}：${ts.promptSnippet}`);
    }
  }

  lines.push("请优先运用以上领域能力来帮助用户。");
  return lines.join("\n");
}

/** Strip existing tool-set injection from a system prompt */
export function stripToolSetInjection(systemPrompt: string): string {
  const marker = "\n\n【工具集配置】";
  const idx = systemPrompt.indexOf(marker);
  if (idx === -1) return systemPrompt;
  return systemPrompt.substring(0, idx);
}

/**
 * Heuristic tool-set matching based on description text.
 * Returns sorted tool set IDs (best match first).
 */
export function matchToolSetsByKeywords(description: string, capabilityHints?: string[]): string[] {
  const lower = description.toLowerCase();
  const scores: Array<{ id: string; score: number }> = [];

  for (const ts of TOOL_SETS) {
    let score = 0;
    for (const kw of ts.matchKeywords) {
      if (lower.includes(kw.toLowerCase())) {
        score += 1;
      }
    }
    // Bonus for capability hints from LLM
    if (capabilityHints) {
      for (const cap of capabilityHints) {
        if (ts.capabilities.some((c) => c.toLowerCase() === cap.toLowerCase())) {
          score += 2;
        }
      }
    }
    if (score > 0) {
      scores.push({ id: ts.id, score });
    }
  }

  return scores.sort((a, b) => b.score - a.score).map((s) => s.id);
}
