// ============================================================
// AgentConfigDraftCard — confirmation card for conversational
// agent creation
// ============================================================

import { CapabilityTags } from "./CapabilityTags.js";

interface AgentConfigDraft {
  name: string;
  platform: string;
  capabilities: string[];
  systemPrompt?: string;
}

interface AgentConfigDraftCardProps {
  draft: AgentConfigDraft;
  onConfirm: () => void;
  onCancel: () => void;
}

export function AgentConfigDraftCard({ draft, onConfirm, onCancel }: AgentConfigDraftCardProps) {
  return (
    <div className="bg-gray-100 dark:bg-gray-800/60 border border-gray-200/80 dark:border-gray-700/50 rounded-2xl p-4 my-3 max-w-[75%]">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">创建新 Agent？</p>

      <div className="space-y-2 mb-3 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400 dark:text-gray-500">名称</span>
          <span className="text-gray-700 dark:text-gray-200">{draft.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400 dark:text-gray-500">平台</span>
          <span className="text-gray-700 dark:text-gray-200">{draft.platform}</span>
        </div>
        {draft.systemPrompt && (
          <div>
            <span className="text-gray-400 dark:text-gray-500 text-xs">System Prompt</span>
            <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5 line-clamp-2">{draft.systemPrompt}</p>
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="text-gray-400 dark:text-gray-500">能力</span>
          <CapabilityTags capabilities={draft.capabilities} max={4} />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-3 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
        >
          取消
        </button>
        <button
          onClick={onConfirm}
          className="px-3 py-1 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded"
        >
          确认创建
        </button>
      </div>
    </div>
  );
}
