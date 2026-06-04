import { useState, useCallback } from "react";
import type { FileChangeRow } from "@agenthub/shared";
import { applyFileChange, revertFileChange } from "../../lib/api.js";
import { DiffCard } from "./DiffCard.js";

interface Props {
  changes: FileChangeRow[];
  onUpdate?: (updated: FileChangeRow) => void;
  collapsible?: boolean;
  workspaceId?: string;
}

export function FileChangeList({ changes, onUpdate, collapsible = true, workspaceId }: Props) {
  const [expanded, setExpanded] = useState(!collapsible);
  const [acting, setActing] = useState<string | null>(null);

  const handleApply = useCallback(async (id: string) => {
    setActing(id);
    try {
      const updated = await applyFileChange(id);
      onUpdate?.(updated);
    } catch (err) {
      console.error("Failed to apply file change", err);
    } finally {
      setActing(null);
    }
  }, [onUpdate]);

  const handleRevert = useCallback(async (id: string) => {
    setActing(id);
    try {
      const updated = await revertFileChange(id);
      onUpdate?.(updated);
    } catch (err) {
      console.error("Failed to revert file change", err);
    } finally {
      setActing(null);
    }
  }, [onUpdate]);

  if (changes.length === 0) return null;

  const pendingCount = changes.filter((c) => c.status === "pending").length;

  return (
    <div className="border border-gray-200/80 dark:border-gray-700/50 rounded-2xl overflow-hidden">
      {collapsible && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800/50 bg-gray-100 dark:bg-gray-800/30"
        >
          <span className="text-xs text-gray-400 dark:text-gray-500">{expanded ? "▾" : "▸"}</span>
          <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">文件变更</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">({changes.length})</span>
          {pendingCount > 0 && (
            <span className="text-xs text-yellow-400 ml-1">({pendingCount} 待处理)</span>
          )}
        </button>
      )}
      {expanded && (
        <div className="divide-y divide-gray-200 dark:divide-gray-800">
          {changes.map((change) => (
            <div key={change.id} className="bg-white/50 dark:bg-gray-900/50">
              <DiffCard change={change} workspaceId={workspaceId} />
              {change.status === "pending" && (
                <div className="flex gap-2 px-3 py-1.5 border-t border-gray-200/80 dark:border-gray-800/50">
                  <button
                    onClick={() => handleApply(change.id)}
                    disabled={acting === change.id}
                    className="text-xs px-2 py-1 rounded bg-green-600/20 text-green-400 hover:bg-green-600/40 disabled:opacity-50"
                  >
                    {acting === change.id ? "处理中..." : "应用变更"}
                  </button>
                  <button
                    onClick={() => handleRevert(change.id)}
                    disabled={acting === change.id}
                    className="text-xs px-2 py-1 rounded bg-red-600/20 text-red-400 hover:bg-red-600/40 disabled:opacity-50"
                  >
                    {acting === change.id ? "处理中..." : "回滚变更"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
