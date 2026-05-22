// ============================================================
// ToolInvocationCard — inline tool usage card in message
// ============================================================

import { useState } from "react";

interface ToolInvocation {
  id?: string;
  toolName: string;
  inputJson?: string;
  outputJson?: string;
  status: string;
}

const statusBadge: Record<string, { color: string; label: string }> = {
  running: { color: "bg-blue-900/30 border-blue-700 text-blue-300", label: "运行中" },
  success: { color: "bg-green-900/30 border-green-700 text-green-300", label: "成功" },
  error: { color: "bg-red-900/30 border-red-700 text-red-300", label: "失败" },
};

interface ToolInvocationCardProps {
  tool: ToolInvocation;
}

export function ToolInvocationCard({ tool }: ToolInvocationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const badge = statusBadge[tool.status] ?? { color: "bg-blue-900/30 border-blue-700 text-blue-300", label: "运行中" };

  let input: unknown = undefined;
  if (tool.inputJson) {
    try { input = JSON.parse(tool.inputJson); } catch { input = tool.inputJson; }
  }
  let output: unknown = undefined;
  if (tool.outputJson) {
    try { output = JSON.parse(tool.outputJson); } catch { output = tool.outputJson; }
  }

  return (
    <div className="mt-2 border border-gray-700 rounded-lg overflow-hidden text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-750 text-left"
      >
        <span className="text-gray-400">🔧</span>
        <span className="text-gray-300 font-medium flex-1">{tool.toolName}</span>
        <span className={`px-1.5 py-0.5 rounded-full border text-[10px] ${badge.color}`}>
          {badge.label}
        </span>
        <span className="text-gray-500 text-[10px]">{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <div className="px-3 py-2 space-y-2 bg-gray-900/50">
          {input !== undefined && (
            <div>
              <span className="text-gray-500">Input</span>
              <pre className="text-gray-400 mt-0.5 truncate max-h-24 overflow-hidden">
                {typeof input === "string" ? input : JSON.stringify(input, null, 2)}
              </pre>
            </div>
          )}
          {output !== undefined && (
            <div>
              <span className="text-gray-500">Output</span>
              <pre className="text-gray-400 mt-0.5 truncate max-h-24 overflow-hidden">
                {typeof output === "string" ? output : JSON.stringify(output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
