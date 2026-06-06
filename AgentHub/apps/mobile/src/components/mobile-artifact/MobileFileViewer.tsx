interface Props {
  content: string;
  fileName: string;
}

export function MobileFileViewer({ content, fileName }: Props) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  const isMarkdown = ext === "md" || ext === "markdown";
  const isCode = ["ts", "tsx", "js", "jsx", "json", "css", "html", "py", "java", "go", "rs", "yaml", "yml", "toml"].includes(ext || "");

  return (
    <div className="px-4 py-4">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
        {/* File header */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <span className="text-sm">{isMarkdown ? "📝" : isCode ? "💻" : "📄"}</span>
          <span className="text-xs font-mono text-gray-600 dark:text-gray-400 truncate flex-1">
            {fileName}
          </span>
          <span className="text-[10px] text-gray-400">{ext?.toUpperCase()}</span>
        </div>

        {/* Content */}
        <div className="p-4 overflow-x-auto">
          {isCode || !isMarkdown ? (
            <pre className="text-xs font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
              {content}
            </pre>
          ) : (
            <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
              {content}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
