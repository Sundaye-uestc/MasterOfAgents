import { useCallback, useState } from "react";
import { useWorkspaceStore } from "@agenthub/web/stores/workspace.store";
import { applyFileChange, revertFileChange } from "@agenthub/web/lib/api";
import { MobileDiffSummary } from "../mobile-artifact/MobileDiffSummary.jsx";

interface Props {
  onClose: () => void;
}

export function MobileFileChangePopup({ onClose }: Props) {
  const fileChanges = useWorkspaceStore((s) => s.fileChanges);
  const pending = fileChanges.filter((c) => c.status === "pending");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApply = useCallback(async (id: string) => {
    try {
      await applyFileChange(id);
      useWorkspaceStore.getState().updateFileChange({ id, status: "applied" } as any);
    } catch { /* ignore */ }
  }, []);

  const handleRevert = useCallback(async (id: string) => {
    try {
      await revertFileChange(id);
      useWorkspaceStore.getState().updateFileChange({ id, status: "reverted" } as any);
    } catch { /* ignore */ }
  }, []);

  // Auto-close when no pending changes remain
  if (pending.length === 0) {
    // defer to next tick so the parent doesn't see a setState-during-render
    setTimeout(onClose, 0);
    return null;
  }

  return (
    <div className="mx-2 mt-2 flex-shrink-0">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl max-h-[50vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            文件变更 ({pending.length})
          </h3>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 touch-target"
          >
            ✕
          </button>
        </div>

        {/* File list */}
        <div className="overflow-y-auto px-3 py-2 space-y-2">
          {pending.map((change) => {
            const isExpanded = expandedIds.has(change.id);
            const fileName = change.path.split("/").pop() ?? change.path;

            return (
              <div
                key={change.id}
                className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden"
              >
                {/* File row */}
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold flex-shrink-0 ${
                      change.changeType === "create"
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                        : change.changeType === "delete"
                          ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                          : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
                    }`}
                  >
                    {change.changeType === "create" ? "+" : change.changeType === "delete" ? "−" : "~"}
                  </span>
                  <span className="text-xs text-gray-700 dark:text-gray-300 truncate flex-1 font-mono">
                    {fileName}
                  </span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate max-w-[40%] hidden sm:inline">
                    {change.path}
                  </span>
                </div>

                {/* Diff — expandable */}
                {change.diff && (
                  <div className="px-3 pb-2">
                    <button
                      onClick={() => toggleExpand(change.id)}
                      className="text-[11px] text-blue-600 dark:text-blue-400 mb-1.5 touch-target"
                    >
                      {isExpanded ? "收起差异" : "展开差异"}
                    </button>
                    {isExpanded && <MobileDiffSummary diffText={change.diff} />}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-1.5 px-3 pb-2.5">
                  <button
                    onClick={() => handleRevert(change.id)}
                    className="flex-1 py-2 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-xs font-medium active:bg-red-200 dark:active:bg-red-900/40 touch-target"
                  >
                    回退
                  </button>
                  <button
                    onClick={() => handleApply(change.id)}
                    className="flex-1 py-2 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg text-xs font-medium active:bg-green-200 dark:active:bg-green-900/40 touch-target"
                  >
                    应用
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
