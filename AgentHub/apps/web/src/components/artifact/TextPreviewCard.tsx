import { useState, useEffect } from "react";

interface Props {
  /** URL to fetch the raw text content from */
  url: string;
  /** Display name for the header */
  name: string;
  /** Optional MIME type for language hint */
  mimeType?: string | null;
  /** Max lines to show when collapsed */
  maxLines?: number;
  /** Max characters before auto-collapsing */
  maxChars?: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function languageFromMime(mimeType: string | null | undefined): string {
  if (!mimeType) return "";
  const map: Record<string, string> = {
    "text/plain": "txt",
    "text/css": "css",
    "text/typescript": "typescript",
    "application/javascript": "javascript",
    "application/json": "json",
    "text/x-diff": "diff",
    "text/markdown": "markdown",
    "text/html": "html",
    "text/xml": "xml",
    "text/csv": "csv",
    "text/x-python": "python",
    "text/x-java": "java",
    "text/x-go": "go",
    "text/x-rust": "rust",
    "text/x-c": "c",
    "text/x-c++": "cpp",
    "text/x-shellscript": "shell",
    "text/x-ruby": "ruby",
    "text/x-php": "php",
    "text/x-swift": "swift",
    "text/x-kotlin": "kotlin",
    "text/x-scala": "scala",
    "text/x-r": "r",
    "text/x-sql": "sql",
    "text/x-lua": "lua",
    "text/x-toml": "toml",
    "text/x-yaml": "yaml",
  };
  return map[mimeType] ?? "";
}

export function TextPreviewCard({ url, name, mimeType, maxLines = 200, maxChars = 80000 }: Props) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [contentCollapsed, setContentCollapsed] = useState(true); // large content truncation

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.text();
        if (!cancelled) {
          setText(raw);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [url]);

  const lineCount = text ? text.split("\n").length : 0;
  const charCount = text ? text.length : 0;
  const needsTruncation = text && contentCollapsed && (
    lineCount > maxLines || charCount > maxChars
  );

  let displayText = text;
  if (needsTruncation) {
    const lines = text!.split("\n");
    if (lines.length > maxLines) {
      displayText = lines.slice(0, maxLines).join("\n") + "\n...";
    } else if (text!.length > maxChars) {
      displayText = text!.slice(0, maxChars) + "\n...";
    }
  }

  const lang = languageFromMime(mimeType);

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-3 py-1.5 bg-gray-800/50 border-b border-gray-700 flex items-center gap-2">
        <span className="text-xs text-gray-400">📄</span>
        <span className="text-xs text-gray-300 truncate">{name}</span>
        {text && (
          <span className="text-xs text-gray-600 flex-shrink-0">
            {lineCount} 行 · {formatSize(charCount)}
          </span>
        )}
        {lang && (
          <span className="text-xs text-gray-600 flex-shrink-0 font-mono">{lang}</span>
        )}
        <a
          href={url}
          download={name}
          className="text-xs text-blue-400 hover:text-blue-300 ml-auto flex-shrink-0"
        >
          下载
        </a>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-xs text-gray-500 hover:text-gray-300 flex-shrink-0 font-mono"
          title={collapsed ? "展开" : "收起"}
        >
          {collapsed ? "><" : "</>"}
        </button>
      </div>

      {/* Body */}
      {!collapsed && (
        <>
          {loading && (
            <div className="px-3 py-2 text-xs text-gray-500 bg-gray-900/50">加载中...</div>
          )}
          {error && (
            <div className="px-3 py-2 text-xs text-red-400 bg-gray-900/50">加载失败: {error}</div>
          )}
          {displayText && (
            <div className="bg-gray-950">
              <pre className="text-xs text-gray-300 p-3 max-h-96 overflow-auto font-mono leading-relaxed whitespace-pre">
                {displayText}
              </pre>
              {needsTruncation && (
                <div className="px-3 py-1.5 bg-gray-900/50 border-t border-gray-800">
                  <button
                    onClick={() => setContentCollapsed(false)}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    展开全部（{lineCount} 行 · {formatSize(charCount)}）
                  </button>
                </div>
              )}
              {!needsTruncation && contentCollapsed && text && text.length < charCount && (
                <div className="px-3 py-1.5 bg-gray-900/50 border-t border-gray-800">
                  <button
                    onClick={() => setContentCollapsed(false)}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    展开全部（{lineCount} 行）
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
