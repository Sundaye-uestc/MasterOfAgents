import { useState } from "react";
import type { FileChangeRow } from "@agenthub/shared";
import { DiffBlock } from "./DiffBlock.js";
import { applyFileChange, revertFileChange } from "../../lib/api.js";

interface Props {
  change: FileChangeRow;
  onUpdate?: (updated: FileChangeRow) => void;
}

const changeColors: Record<string, string> = {
  create: "text-green-400 border-green-600 bg-green-900/20",
  modify: "text-yellow-400 border-yellow-600 bg-yellow-900/20",
  delete: "text-red-400 border-red-600 bg-red-900/20",
};

const changeLabels: Record<string, string> = {
  create: "+",
  modify: "~",
  delete: "-",
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

export function InlineDiffCard({ change, onUpdate }: Props) {
  const [applying, setApplying] = useState(false);

  const handleApply = async () => {
    setApplying(true);
    try {
      const updated = await applyFileChange(change.id);
      onUpdate?.(updated);
    } catch {
      // best effort
    } finally {
      setApplying(false);
    }
  };

  const handleRevert = async () => {
    setApplying(true);
    try {
      const updated = await revertFileChange(change.id);
      onUpdate?.(updated);
    } catch {
      // best effort
    } finally {
      setApplying(false);
    }
  };

  const isPending = change.status === "pending";

  return (
    <div className={`border rounded-md overflow-hidden text-xs ${changeColors[change.changeType] ?? "border-gray-700"}`}>
      {/* Header */}
      <div className="px-2 py-1.5 flex items-center gap-1.5 bg-gray-800/50">
        <span className={`font-mono font-bold px-1 rounded ${changeColors[change.changeType] ?? ""}`}>
          {changeLabels[change.changeType] ?? "?"}
        </span>
        <span className="text-gray-300 font-mono truncate flex-1">{change.path}</span>
        <span className={`px-1 py-0.5 rounded text-xs ${statusColors[change.status] ?? ""}`}>
          {statusLabels[change.status] ?? change.status}
        </span>
      </div>

      {/* Diff body */}
      {change.diff ? (
        <div className="border-t border-gray-700 bg-gray-950">
          <DiffBlock diff={change.diff} filePath={change.path} collapsible={false} />
        </div>
      ) : (
        <div className="border-t border-gray-700 bg-gray-950 px-2 py-1.5">
          <span className="text-gray-500">
            {change.changeType === "delete"
              ? "文件已删除"
              : change.changeType === "create"
              ? "新文件已创建"
              : "文件已修改（无差异数据）"}
          </span>
        </div>
      )}

      {/* Actions (only for pending changes) */}
      {isPending && (
        <div className="border-t border-gray-700 bg-gray-800/30 px-2 py-1 flex items-center gap-2">
          <button
            onClick={handleApply}
            disabled={applying}
            className="px-2 py-0.5 rounded bg-green-600/20 text-green-400 hover:bg-green-600/40 disabled:opacity-50"
          >
            {applying ? "..." : "✓ 应用"}
          </button>
          <button
            onClick={handleRevert}
            disabled={applying}
            className="px-2 py-0.5 rounded bg-orange-600/20 text-orange-400 hover:bg-orange-600/40 disabled:opacity-50"
          >
            {applying ? "..." : "↩ 回滚"}
          </button>
        </div>
      )}
    </div>
  );
}
