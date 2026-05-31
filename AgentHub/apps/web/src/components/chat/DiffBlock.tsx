import { useState, useMemo } from "react";
import { useUIStore } from "../../stores/ui.store.js";

interface Props {
  diff: string;
  filePath?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  /** Number of lines above which the diff is collapsed by default */
  collapseThreshold?: number;
}

interface DiffLine {
  type: "add" | "remove" | "context" | "header" | "meta";
  content: string;
}

/** Parse a unified diff string into typed lines */
function parseDiff(diffText: string): DiffLine[] {
  const lines = diffText.split("\n");
  return lines.map((line) => {
    if (line.startsWith("--- ") || line.startsWith("+++ ")) {
      return { type: "meta", content: line };
    }
    if (line.startsWith("@@")) {
      return { type: "header", content: line };
    }
    if (line.startsWith("+")) {
      return { type: "add", content: line };
    }
    if (line.startsWith("-")) {
      return { type: "remove", content: line };
    }
    return { type: "context", content: line };
  });
}

const lineStyles: Record<DiffLine["type"], string> = {
  add: "bg-green-900/30 border-l-2 border-green-500 text-green-300",
  remove: "bg-red-900/30 border-l-2 border-red-500 text-red-300",
  header: "bg-blue-900/30 text-cyan-300 font-medium",
  meta: "text-gray-500",
  context: "text-gray-300",
};

export function DiffBlock({ diff, filePath, collapsible = true, defaultExpanded = false, collapseThreshold = 20 }: Props) {
  const parsedLines = useMemo(() => parseDiff(diff), [diff]);
  const lineCount = parsedLines.length;
  const shouldCollapse = collapsible && lineCount > collapseThreshold;
  const [expanded, setExpanded] = useState(defaultExpanded || !shouldCollapse);

  // Extract file path from diff header for linking
  const extractedPath = filePath ?? (() => {
    const metaLine = parsedLines.find((l) => l.type === "meta");
    if (metaLine) {
      const m = metaLine.content.match(/^[+-]{3} [ab]\/(.+)/);
      if (m) return m[1];
    }
    return undefined;
  })();

  const handleFilePathClick = () => {
    if (extractedPath) {
      const ui = useUIStore.getState();
      ui.selectChangePath(extractedPath);
      ui.openPanel("workspace");
    }
  };

  const previewLines = shouldCollapse ? parsedLines.slice(0, 10) : parsedLines;

  return (
    <div className="border border-gray-700 rounded-md overflow-hidden my-1">
      {/* File path header */}
      {extractedPath && (
        <button
          onClick={handleFilePathClick}
          className="w-full text-left px-3 py-1.5 bg-gray-800/50 border-b border-gray-700 text-xs text-gray-400 font-mono hover:bg-gray-700/50 hover:text-blue-400 flex items-center gap-2"
          title="在变更面板中查看"
        >
          <span>📄</span>
          <span className="truncate">{extractedPath}</span>
          <span className="ml-auto text-gray-600 text-[10px]">点击定位</span>
        </button>
      )}

      {/* Diff content */}
      <div className="overflow-x-auto">
        {previewLines.map((line, i) => (
          <div key={i} className={`${lineStyles[line.type]} text-xs font-mono whitespace-pre px-2 py-0`}>
            {line.content || " "}
          </div>
        ))}
      </div>

      {/* Expand/collapse button for long diffs */}
      {shouldCollapse && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full text-center py-1.5 bg-gray-800/30 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 border-t border-gray-700"
        >
          展开完整差异（共 {lineCount} 行）
        </button>
      )}

      {/* Expanded: show remaining lines */}
      {shouldCollapse && expanded && (
        <>
          <div className="overflow-x-auto">
            {parsedLines.slice(10).map((line, i) => (
              <div key={i + 10} className={`${lineStyles[line.type]} text-xs font-mono whitespace-pre px-2 py-0`}>
                {line.content || " "}
              </div>
            ))}
          </div>
          <button
            onClick={() => setExpanded(false)}
            className="w-full text-center py-1.5 bg-gray-800/30 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 border-t border-gray-700"
          >
            收起差异
          </button>
        </>
      )}
    </div>
  );
}
