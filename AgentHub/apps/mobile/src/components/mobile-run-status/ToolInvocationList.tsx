import { useState } from "react";
import type { ToolInvocationRow } from "@agenthub/shared";

interface Props {
  invocations: ToolInvocationRow[];
}

const statusIcon: Record<string, string> = {
  pending: "⏳",
  running: "🔄",
  success: "✅",
  error: "❌",
};

export function ToolInvocationList({ invocations }: Props) {
  return (
    <div className="space-y-1 mt-1">
      {invocations.map((inv) => (
        <ToolInvocationItem key={inv.id} invocation={inv} />
      ))}
    </div>
  );
}

function ToolInvocationItem({ invocation }: { invocation: ToolInvocationRow }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="text-xs border border-gray-100 dark:border-gray-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-800/50 touch-target"
      >
        <span>{statusIcon[invocation.status || "pending"] || "⏳"}</span>
        <span className="text-gray-600 dark:text-gray-400 font-medium flex-1 text-left">
          {invocation.toolName || "tool"}
        </span>
        <span className="text-gray-400 text-[10px]">{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <div className="px-3 py-2 space-y-1 bg-white dark:bg-gray-900">
          {invocation.inputJson && (
            <div>
              <span className="text-[10px] text-gray-400">Input:</span>
              <pre className="text-[10px] text-gray-600 dark:text-gray-400 overflow-x-auto whitespace-pre-wrap">
                {typeof invocation.inputJson === "string" ? invocation.inputJson : JSON.stringify(invocation.inputJson, null, 2)}
              </pre>
            </div>
          )}
          {invocation.outputJson && (
            <div>
              <span className="text-[10px] text-gray-400">Output:</span>
              <pre className="text-[10px] text-gray-600 dark:text-gray-400 overflow-x-auto whitespace-pre-wrap">
                {typeof invocation.outputJson === "string" ? invocation.outputJson : JSON.stringify(invocation.outputJson, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
