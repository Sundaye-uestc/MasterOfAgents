import { useState } from "react";

interface Props {
  diffText: string;
}

export function MobileDiffSummary({ diffText }: Props) {
  const [expanded, setExpanded] = useState(false);

  // Count additions and deletions
  const lines = diffText.split("\n");
  const additions = lines.filter((l) => l.startsWith("+") && !l.startsWith("+++")).length;
  const deletions = lines.filter((l) => l.startsWith("-") && !l.startsWith("---")).length;

  // Preview: first 20 lines
  const previewLines = expanded ? lines : lines.slice(0, 20);
  const showMore = !expanded && lines.length > 20;

  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden text-xs">
      {/* Summary bar */}
      <div className="flex items-center gap-3 px-3 py-1.5 bg-gray-100 dark:bg-gray-700/50 font-mono text-[11px]">
        <span className="text-green-600 dark:text-green-400">+{additions}</span>
        <span className="text-red-600 dark:text-red-400">-{deletions}</span>
      </div>

      {/* Diff content */}
      <div className="overflow-x-auto">
        {previewLines.map((line, i) => {
          let colorClass = "text-gray-600 dark:text-gray-400";
          if (line.startsWith("+") && !line.startsWith("+++")) {
            colorClass = "text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/10";
          } else if (line.startsWith("-") && !line.startsWith("---")) {
            colorClass = "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/10";
          } else if (line.startsWith("@@")) {
            colorClass = "text-blue-600 dark:text-blue-400 font-medium";
          }
          return (
            <div key={i} className={`px-3 py-0.5 font-mono ${colorClass}`}>
              {line || " "}
            </div>
          );
        })}
      </div>

      {showMore && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full py-1.5 text-center text-blue-600 dark:text-blue-400 text-[11px] font-medium bg-gray-100 dark:bg-gray-700/50 active:bg-gray-200 dark:active:bg-gray-700 touch-target"
        >
          展开全部 ({lines.length} 行)
        </button>
      )}
    </div>
  );
}
