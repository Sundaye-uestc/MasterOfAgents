import { useCallback, useState, useEffect } from "react";
import { useMobileUIStore, permissionWsSender } from "../stores/mobile-ui.store.js";
import { applyFileChange, revertFileChange } from "@agenthub/web/lib/api";
import { useWorkspaceStore } from "@agenthub/web/stores/workspace.store";
import { MobileDiffSummary } from "../components/mobile-artifact/MobileDiffSummary.jsx";

export function ApprovalPage() {
  const stack = useMobileUIStore((s) => s.stack);
  const pop = useMobileUIStore((s) => s.pop);
  const entry = stack[stack.length - 1];
  const params = (entry?.params || {}) as Record<string, unknown>;

  const fileChanges = useWorkspaceStore((s) => s.fileChanges);
  const [result, setResult] = useState<string | null>(null);

  // Handle permission response — sends via WebSocket (server does NOT have an HTTP route for this)
  const handlePermission = useCallback(
    (approved: boolean) => {
      const runId = params.runId as string;
      const permissionId = params.permissionId as string;
      if (!runId || !permissionId) return;
      if (!permissionWsSender.send) {
        setResult("WebSocket 未连接");
        return;
      }
      permissionWsSender.send({
        type: "permission:respond",
        runId,
        permissionId,
        approved,
      });
      setResult(approved ? "已批准" : "已拒绝");
      setTimeout(() => pop(), 1000);
    },
    [params.runId, params.permissionId, pop]
  );

  // Handle diff apply/revert
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

  const isPermission = !!params.runId && !!params.permissionId;
  const pendingChanges = fileChanges.filter((c) => c.status === "pending");

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950 pt-safe">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95" style={{ minHeight: "56px" }}>
        <button
          onClick={() => pop()}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 touch-target flex-shrink-0"
        >
          ←
        </button>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">审批</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-safe">
        {result && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3 text-sm text-green-700 dark:text-green-300 text-center">
            {result}
          </div>
        )}

        {/* Permission request */}
        {isPermission && !result && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 space-y-3">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Agent 请求权限
            </div>
            {(params.toolName as string) && (
              <div className="text-xs text-gray-500">
                工具: <span className="font-mono text-gray-700 dark:text-gray-300">{params.toolName as string}</span>
              </div>
            )}
            {(params.description as string) && (
              <div className="text-xs text-gray-500">
                描述: <span className="text-gray-700 dark:text-gray-300">{params.description as string}</span>
              </div>
            )}
            {(params.command as string) && (
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
                  {params.command as string}
                </pre>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => handlePermission(false)}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-medium active:bg-red-600 touch-target"
              >
                拒绝
              </button>
              <button
                onClick={() => handlePermission(true)}
                className="flex-1 py-3 bg-green-600 text-white rounded-xl font-medium active:bg-green-700 touch-target"
              >
                批准
              </button>
            </div>
          </div>
        )}

        {/* File changes */}
        {!isPermission && (
          <>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              文件变更 ({pendingChanges.length})
            </h3>
            {pendingChanges.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">暂无待审批的变更</p>
            ) : (
              pendingChanges.map((change) => (
                <div key={change.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                      change.changeType === "create"
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                        : change.changeType === "delete"
                          ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                          : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
                    }`}>
                      {change.changeType === "create" ? "+" : change.changeType === "delete" ? "−" : "~"}
                    </span>
                    <span className="text-xs font-mono text-gray-700 dark:text-gray-300 truncate flex-1">
                      {change.path}
                    </span>
                  </div>
                  {change.diff && (
                    <MobileDiffSummary diffText={change.diff} />
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRevert(change.id)}
                      className="flex-1 py-2.5 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl text-sm font-medium active:bg-red-200 dark:active:bg-red-900/40 touch-target"
                    >
                      回退
                    </button>
                    <button
                      onClick={() => handleApply(change.id)}
                      className="flex-1 py-2.5 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-xl text-sm font-medium active:bg-green-200 dark:active:bg-green-900/40 touch-target"
                    >
                      应用
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
