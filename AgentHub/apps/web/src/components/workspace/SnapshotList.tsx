import { useState, useEffect } from "react";
import type { FileChangeRow } from "@agenthub/shared";

interface SnapshotItem {
  id: string;
  label: string | null;
  createdAt: string;
  runId: string | null;
}

interface Props {
  snapshots: SnapshotItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRollback?: (snapshotId: string) => void;
  fileChanges?: FileChangeRow[];
  onNavigateToRun?: (runId: string) => void;
}

export function SnapshotList({ snapshots, selectedId, onSelect, onRollback, fileChanges, onNavigateToRun }: Props) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  if (snapshots.length === 0) {
    return <div className="px-4 py-8 text-xs text-gray-400 text-center">暂无快照</div>;
  }

  // Only show "after" snapshots — "before" is internal for diff generation
  const sorted = [...snapshots]
    .filter((s) => s.label?.includes("对话后"))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="py-2">
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 px-4 py-2.5 rounded-2xl shadow-xl backdrop-blur-sm text-sm ${
          toast.type === "success"
            ? "bg-green-800/90 text-green-200 border border-green-700/50"
            : "bg-red-800/90 text-red-200 border border-red-700/50"
        }`}>
          {toast.type === "success" ? "✅ " : "❌ "}{toast.message}
        </div>
      )}

      <div className="relative ml-3 pl-4 border-l border-gray-200 dark:border-gray-700/50">
        {sorted.map((snap) => {
          const time = new Date(snap.createdAt).toLocaleString("zh-CN", {
            month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
          });
          const isExpanded = expandedId === snap.id;
          const isConfirming = confirmId === snap.id;
          const snapshotChanges = (fileChanges ?? []).filter((fc) => fc.runId === snap.runId);

          // Extract title from label (format: "对话后 · Title · \"msg\"")
          const labelParts = snap.label?.split(" · ") ?? [];
          const title = labelParts.slice(1).join(" · ") || snap.label || "快照";

          return (
            <div key={snap.id} className="relative pb-3 last:pb-0 group">
              {/* Timeline dot */}
              <span className={`absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full border-2 transition-colors ${
                isExpanded
                  ? "border-blue-500 bg-blue-500"
                  : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
              }`} />

              {/* Snapshot row */}
              <button
                onClick={() => {
                  onSelect(snap.id);
                  setExpandedId(isExpanded ? null : snap.id);
                  if (!isExpanded && snap.runId) onNavigateToRun?.(snap.runId);
                }}
                className="w-full text-left"
              >
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className={`text-xs font-medium truncate max-w-[160px] ${
                    isExpanded ? "text-blue-600 dark:text-blue-400" : "text-gray-600 dark:text-gray-400"
                  }`}>
                    {title}
                  </span>
                  <span className="text-[10px] text-gray-400 flex-shrink-0 ml-auto">{time}</span>
                  {snapshotChanges.length > 0 && (
                    <span className="text-[10px] text-gray-400 flex-shrink-0 ml-1.5">{snapshotChanges.length} 文件</span>
                  )}
                </div>
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="mt-2 ml-1 space-y-1">
                  {snapshotChanges.length === 0 ? (
                    <p className="text-[10px] text-gray-400">无文件变更</p>
                  ) : (
                    snapshotChanges.map((fc) => (
                      <div key={fc.id} className="flex items-center gap-1.5 text-[10px]">
                        <span className={`font-mono flex-shrink-0 ${
                          fc.changeType === "create" ? "text-green-500" :
                          fc.changeType === "delete" ? "text-red-500" :
                          "text-yellow-500"
                        }`}>
                          {fc.changeType === "create" ? "+" : fc.changeType === "delete" ? "−" : "~"}
                        </span>
                        <span className="text-gray-600 dark:text-gray-400 font-mono truncate flex-1 min-w-0">{fc.path}</span>
                        {fc.diff && (
                          <span className="text-gray-400 flex-shrink-0 ml-1">
                            {fc.diff.split("\n").filter(l => l.startsWith("+") && !l.startsWith("+++") || l.startsWith("-") && !l.startsWith("---")).length} 行
                          </span>
                        )}
                      </div>
                    ))
                  )}

                  {/* Rollback button */}
                  {onRollback && (
                    <div className="mt-1.5 pt-1.5 border-t border-gray-100 dark:border-gray-800/50">
                      {isConfirming ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-orange-500 flex-1">确认回滚？将覆盖当前所有文件</span>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                await onRollback(snap.id);
                                setToast({ type: "success", message: "已回滚" });
                              } catch {
                                setToast({ type: "error", message: "回滚失败" });
                              }
                              setConfirmId(null);
                            }}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 font-medium"
                          >
                            确认
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmId(null); }}
                            className="text-[10px] text-gray-400 hover:text-gray-300"
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmId(snap.id); }}
                          className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
                          title="回滚到此快照"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          回滚
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
