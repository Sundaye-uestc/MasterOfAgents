// ============================================================
// AgentCreationModal — manual agent creation form
// ============================================================

import { useState } from "react";
import type { AgentRow } from "@agenthub/shared";
import { TOOL_SETS } from "@agenthub/shared";
import { createAgentFromDraft } from "../../lib/api.js";

interface AgentCreationModalProps {
  onClose: () => void;
  onCreated: (agent: AgentRow) => void;
}

export function AgentCreationModal({ onClose, onCreated }: AgentCreationModalProps) {
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState("claude-code");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [toolSetIds, setToolSetIds] = useState<string[]>([]);
  const [capInput, setCapInput] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const addCapability = () => {
    const tag = capInput.trim();
    if (tag && !capabilities.includes(tag)) {
      setCapabilities((prev) => [...prev, tag]);
    }
    setCapInput("");
  };

  const removeCapability = (tag: string) => {
    setCapabilities((prev) => prev.filter((c) => c !== tag));
  };

  const toggleToolSet = (id: string) => {
    setToolSetIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const handleConfirm = async () => {
    if (!name.trim()) {
      setError("请输入 Agent 名称");
      return;
    }
    setCreating(true);
    setError("");
    try {
      const agent = await createAgentFromDraft({
        name: name.trim(),
        platform,
        systemPrompt,
        capabilities,
        toolSetIds,
      });
      onCreated(agent);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800/95 backdrop-blur-md border border-gray-200 dark:border-gray-700/50 rounded-2xl p-6 w-[520px] shadow-2xl max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">新建 Agent</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Name */}
        <label className="block mb-3">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">名称</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:border-blue-500"
            placeholder="例如：代码审查员"
            autoFocus
          />
        </label>

        {/* Platform */}
        <label className="block mb-3">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">平台</span>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="mt-1 w-full px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:border-blue-500"
          >
            <option value="claude-code">Claude Code</option>
            <option value="codex">Codex</option>
          </select>
        </label>

        {/* System Prompt */}
        <label className="block mb-3">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">System Prompt</span>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={6}
            className="mt-1 w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:border-blue-500 resize-vertical font-mono"
            placeholder="定义 Agent 的行为和专业领域..."
          />
        </label>

        {/* Capabilities */}
        <label className="block mb-3">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">能力标签</span>
          <div className="flex gap-1 mt-1">
            <input
              type="text"
              value={capInput}
              onChange={(e) => setCapInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCapability();
                }
              }}
              className="flex-1 px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:border-blue-500"
              placeholder="输入后按回车添加..."
            />
            <button
              onClick={addCapability}
              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg"
            >
              +
            </button>
          </div>
          {capabilities.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {capabilities.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                >
                  {tag}
                  <button
                    onClick={() => removeCapability(tag)}
                    className="text-blue-400 hover:text-blue-600 dark:hover:text-blue-200"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </label>

        {/* Tool Sets */}
        <label className="block mb-4">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">工具集</span>
          <div className="grid grid-cols-2 gap-1.5 mt-1">
            {TOOL_SETS.map((ts) => {
              const selected = toolSetIds.includes(ts.id);
              return (
                <button
                  key={ts.id}
                  onClick={() => toggleToolSet(ts.id)}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-left transition-colors ${
                    selected
                      ? "bg-purple-100 dark:bg-purple-900/30 border border-purple-300 dark:border-purple-700 text-purple-800 dark:text-purple-200"
                      : "bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <span>{ts.icon}</span>
                  <span>{ts.label}</span>
                </button>
              );
            })}
          </div>
        </label>

        {/* Error */}
        {error && (
          <p className="text-xs text-red-500 mb-3">{error}</p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={creating}
            className="px-4 py-1.5 text-sm text-gray-600 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={creating}
            className="px-4 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
          >
            {creating ? "创建中..." : "确认创建"}
          </button>
        </div>
      </div>
    </div>
  );
}
