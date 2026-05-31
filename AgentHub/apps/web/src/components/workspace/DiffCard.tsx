import { useState } from "react";
import type { FileChangeRow } from "@agenthub/shared";
import { DiffBlock } from "../chat/DiffBlock.js";

interface Props {
  change: FileChangeRow;
}

const changeColors: Record<string, string> = {
  create: "text-green-400 border-green-600 bg-green-900/20",
  modify: "text-yellow-400 border-yellow-600 bg-yellow-900/20",
  delete: "text-red-400 border-red-600 bg-red-900/20",
};

const changeLabels: Record<string, string> = {
  create: "新增",
  modify: "修改",
  delete: "删除",
};

const statusColors: Record<string, string> = {
  pending: "text-gray-400 bg-gray-700",
  applied: "text-green-400 bg-green-900/30",
  reverted: "text-orange-400 bg-orange-900/30",
};

const statusLabels: Record<string, string> = {
  pending: "待处理",
  applied: "已应用",
  reverted: "已回滚",
};

export function DiffCard({ change }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`border rounded-lg overflow-hidden ${changeColors[change.changeType] ?? "border-gray-700"}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-gray-800/50"
      >
        <span className="text-xs text-gray-500">{expanded ? "▾" : "▸"}</span>
        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${changeColors[change.changeType] ?? ""}`}>
          {changeLabels[change.changeType] ?? change.changeType}
        </span>
        <span className="text-xs text-gray-300 font-mono truncate flex-1">{change.path}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded ${statusColors[change.status] ?? ""}`}>
          {statusLabels[change.status] ?? change.status}
        </span>
      </button>
      {expanded && change.diff && (
        <div className="border-t border-gray-700 bg-gray-950">
          <DiffBlock diff={change.diff} filePath={change.path} defaultExpanded={true} />
        </div>
      )}
      {expanded && !change.diff && (
        <div className="border-t border-gray-700 bg-gray-950 px-3 py-2">
          <span className="text-xs text-gray-500">
            {change.changeType === "delete"
              ? "文件已删除"
              : change.changeType === "create"
              ? "新文件已创建"
              : "文件已修改（无差异数据）"}
          </span>
        </div>
      )}
    </div>
  );
}
