// ============================================================
// CapabilityTags — colored capability pills with Chinese labels
// ============================================================

// Emoji mapping for capability keywords
export function capabilityEmoji(cap: string): string {
  const emojis: Record<string, string> = {
    "code-generation": "🔧",
    debugging: "🐛",
    refactoring: "🔄",
    "file-management": "📁",
    "code-review": "👀",
    documentation: "📝",
    testing: "🧪",
    analysis: "🔍",
    review: "👀",
    "web-scraping": "🌐",
    "web-development": "🌐",
    security: "🔒",
  };
  const key = (cap ?? "").toLowerCase();
  for (const [k, v] of Object.entries(emojis)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return "⚡";
}

// Chinese label mapping for English capability keys
export function capabilityLabel(cap: string): string {
  // Already Chinese/emoji-rich (AI-generated) → use as-is
  if (/^\p{Emoji}/u.test(cap)) {
    const withoutEmoji = cap.replace(/^\p{Emoji}\s*/u, "");
    const labels: Record<string, string> = {
      "code-generation": "代码生成",
      debugging: "调试",
      testing: "测试",
      analysis: "分析",
      review: "审查",
      "file-management": "文件管理",
      "web-scraping": "网络爬取",
      security: "安全",
      refactoring: "重构",
      "code-review": "代码审查",
      documentation: "文档",
      deployment: "部署",
      "web-development": "Web 开发",
    };
    if (labels[withoutEmoji]) return labels[withoutEmoji];
    // Already Chinese — return as-is
    if (/[一-鿿]/.test(withoutEmoji)) return cap;
    return cap;
  }
  // English key → Chinese label
  const labels: Record<string, string> = {
    "code-generation": "代码生成",
    debugging: "调试",
    testing: "测试",
    analysis: "分析",
    review: "审查",
    "file-management": "文件管理",
    "web-scraping": "网络爬取",
    security: "安全",
    refactoring: "重构",
    "code-review": "代码审查",
    documentation: "文档",
    deployment: "部署",
    "web-development": "Web 开发",
  };
  const key = (cap ?? "").toLowerCase();
  return labels[key] ?? cap;
}

// Format a single capability for display: "🔧 代码生成"
export function formatCapability(cap: string): string {
  // Already Chinese/emoji → use as-is
  if (/^\p{Emoji}/u.test(cap)) return cap;
  return `${capabilityEmoji(cap)} ${capabilityLabel(cap)}`;
}

const capColors: Record<string, string> = {
  "code-generation": "bg-blue-900/40 text-blue-300 border-blue-700",
  debugging: "bg-amber-900/40 text-amber-300 border-amber-700",
  "file-management": "bg-green-900/40 text-green-300 border-green-700",
  "web-development": "bg-purple-900/40 text-purple-300 border-purple-700",
  testing: "bg-cyan-900/40 text-cyan-300 border-cyan-700",
  analysis: "bg-pink-900/40 text-pink-300 border-pink-700",
  refactoring: "bg-orange-900/40 text-orange-300 border-orange-700",
  "code-review": "bg-teal-900/40 text-teal-300 border-teal-700",
  documentation: "bg-indigo-900/40 text-indigo-300 border-indigo-700",
  security: "bg-red-900/40 text-red-300 border-red-700",
};

interface CapabilityTagsProps {
  capabilities: string[];
  max?: number;
}

export function CapabilityTags({ capabilities, max }: CapabilityTagsProps) {
  const shown = max ? capabilities.slice(0, max) : capabilities;
  const remaining = max ? capabilities.length - max : 0;

  return (
    <span className="inline-flex flex-wrap gap-1">
      {shown.map((cap) => {
        const colors = capColors[cap] ?? "bg-gray-800 text-gray-400 border-gray-700";
        return (
          <span key={cap} className={`text-[10px] px-1.5 py-0.5 rounded-full border ${colors}`}>
            {formatCapability(cap)}
          </span>
        );
      })}
      {remaining > 0 && (
        <span className="text-[10px] text-gray-600">+{remaining}</span>
      )}
    </span>
  );
}
