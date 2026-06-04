// ============================================================
// AgentDeleteConfirmModal — confirmation dialog before deletion
// ============================================================

import type { AgentRow } from "@agenthub/shared";
import { AgentBadge } from "../chat/AgentBadge.js";

interface AgentDeleteConfirmModalProps {
  agent: AgentRow;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

export function AgentDeleteConfirmModal({
  agent,
  onClose,
  onConfirm,
  loading,
}: AgentDeleteConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800/95 backdrop-blur-md border border-gray-200 dark:border-gray-700/50 rounded-2xl p-6 w-96 shadow-2xl">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">
          确认删除
        </h2>

        <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg mb-3">
          <AgentBadge
            agentName={agent.name}
            adapterKind={agent.adapterKind}
            avatar={agent.avatar ?? undefined}
            size="md"
          />
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{agent.name}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">{agent.adapterKind}</p>
          </div>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          删除后将无法恢复。该 Agent 在已有对话中的历史消息不受影响。
        </p>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-1.5 text-sm text-gray-600 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-1.5 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
          >
            {loading ? "删除中..." : "确认删除"}
          </button>
        </div>
      </div>
    </div>
  );
}
