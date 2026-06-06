import { useEffect, useState, useCallback } from "react";
import type { AgentRow } from "@agenthub/shared";
import { listAgents } from "@agenthub/web/lib/api";
import { AgentPicker } from "@agenthub/web/components/chat/AgentPicker";

interface Props {
  onClose: () => void;
  onCreate: (title: string, type: "direct" | "group", agentIds: string[]) => void;
}

export function MobileNewConversationModal({ onClose, onCreate }: Props) {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<"direct" | "group">("direct");
  const [selectedAgentId, setSelectedAgentId] = useState("default-claude");
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);

  useEffect(() => {
    listAgents(true).then(setAgents).catch(() => {});
  }, []);

  const handleCreate = useCallback(() => {
    if (!title.trim()) return;
    const agentIds = mode === "direct" ? [selectedAgentId] : selectedAgentIds;
    if (agentIds.length === 0) return;
    onCreate(title.trim(), mode, agentIds);
  }, [title, mode, selectedAgentId, selectedAgentIds, onCreate]);

  const handleAgentToggle = useCallback(
    (agentId: string) => {
      setSelectedAgentIds((prev) =>
        prev.includes(agentId) ? prev.filter((id) => id !== agentId) : [...prev, agentId]
      );
    },
    []
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-t-2xl max-h-[80vh] overflow-y-auto pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">新建会话</h2>
          <button onClick={onClose} className="text-gray-400 text-lg w-8 h-8 flex items-center justify-center touch-target">
            ✕
          </button>
        </div>

        <div className="px-4 py-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">会话名称</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入会话名称"
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:border-blue-500"
              autoFocus
            />
          </div>

          {/* Mode toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">类型</label>
            <div className="flex gap-2">
              <button
                onClick={() => setMode("direct")}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium touch-target ${
                  mode === "direct"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                }`}
              >
                单聊
              </button>
              <button
                onClick={() => setMode("group")}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium touch-target ${
                  mode === "group"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                }`}
              >
                群聊
              </button>
            </div>
          </div>

          {/* Agent selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {mode === "direct" ? "选择 Agent" : "选择 Agents（可多选）"}
            </label>
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
              {agents.length === 0 ? (
                <div className="p-4 text-sm text-gray-400 text-center">加载中...</div>
              ) : mode === "direct" ? (
                agents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => setSelectedAgentId(agent.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0 touch-target ${
                      selectedAgentId === agent.id
                        ? "bg-blue-50 dark:bg-blue-900/20"
                        : "active:bg-gray-50 dark:active:bg-gray-800/50"
                    }`}
                  >
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{agent.name}</div>
                      <div className="text-xs text-gray-500">{agent.adapterKind}</div>
                    </div>
                    {selectedAgentId === agent.id && <span className="text-blue-600 text-sm">✓</span>}
                  </button>
                ))
              ) : (
                agents.map((agent) => {
                  const isSelected = selectedAgentIds.includes(agent.id);
                  return (
                    <button
                      key={agent.id}
                      onClick={() => handleAgentToggle(agent.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0 touch-target ${
                        isSelected ? "bg-blue-50 dark:bg-blue-900/20" : "active:bg-gray-50 dark:active:bg-gray-800/50"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                        isSelected ? "bg-blue-600 border-blue-600" : "border-gray-300 dark:border-gray-600"
                      }`}>
                        {isSelected && <span className="text-white text-xs">✓</span>}
                      </div>
                      <div className="flex-1 text-left">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{agent.name}</div>
                        <div className="text-xs text-gray-500">{agent.adapterKind}</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Create button */}
          <button
            onClick={handleCreate}
            disabled={!title.trim() || (mode === "direct" ? !selectedAgentId : selectedAgentIds.length === 0)}
            className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-medium disabled:opacity-50 active:bg-blue-700 touch-target"
          >
            创建
          </button>
        </div>
      </div>
    </div>
  );
}
