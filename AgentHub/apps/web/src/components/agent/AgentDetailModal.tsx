// ============================================================
// AgentDetailModal — read-only display of agent configuration
// ============================================================

import type { AgentRow } from "@agenthub/shared";
import { AgentBadge } from "../chat/AgentBadge.js";

interface AgentDetailModalProps {
  agent: AgentRow;
  onClose: () => void;
}

export function AgentDetailModal({ agent, onClose }: AgentDetailModalProps) {
  const capabilities: string[] = (() => {
    try {
      return JSON.parse(agent.capabilitiesJson ?? "[]") as string[];
    } catch {
      return [];
    }
  })();

  const config = (() => {
    try {
      return JSON.parse(agent.configJson ?? "{}") as Record<string, unknown>;
    } catch {
      return {};
    }
  })();

  const systemPrompt = (config.systemPrompt as string) ?? "";
  const toolSetIds: string[] = Array.isArray(config.toolSetIds) ? (config.toolSetIds as string[]) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800/95 backdrop-blur-md border border-gray-200 dark:border-gray-700/50 rounded-2xl p-6 w-[480px] shadow-2xl max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <AgentBadge
              agentName={agent.name}
              adapterKind={agent.adapterKind}
              avatar={agent.avatar ?? undefined}
              size="lg"
            />
            <div>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{agent.name}</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500">{agent.adapterKind}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Status & Type */}
        <div className="flex items-center gap-3 mb-4">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
            agent.status === "online"
              ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
              : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              agent.status === "online" ? "bg-green-500" : "bg-gray-400"
            }`} />
            {agent.status}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {agent.isCustom === 1 ? "自建 Agent" : "内置 Agent"}
          </span>
          <span className={`text-xs ${agent.enabled === 1 ? "text-green-500" : "text-red-400"}`}>
            {agent.enabled === 1 ? "已启用" : "已禁用"}
          </span>
        </div>

        {/* Capabilities */}
        {capabilities.length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">能力标签</h3>
            <div className="flex flex-wrap gap-1">
              {capabilities.map((cap) => (
                <span
                  key={cap}
                  className="px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                >
                  {cap}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tool Sets */}
        {toolSetIds.length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">工具集</h3>
            <div className="flex flex-wrap gap-1">
              {toolSetIds.map((id) => (
                <span
                  key={id}
                  className="px-2 py-0.5 text-xs rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400"
                >
                  {id}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* System Prompt */}
        <div className="mb-4">
          <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">System Prompt</h3>
          <pre className="text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3 max-h-48 overflow-y-auto whitespace-pre-wrap">
            {systemPrompt || "（未设置）"}
          </pre>
        </div>

        {/* Timestamps */}
        <div className="text-xs text-gray-400 dark:text-gray-500 space-y-0.5">
          <p>创建时间：{agent.createdAt}</p>
          <p>更新时间：{agent.updatedAt}</p>
        </div>

        {/* Close button */}
        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm text-gray-600 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
