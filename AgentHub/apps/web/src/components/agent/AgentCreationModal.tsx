// ============================================================
// AgentCreationModal — dialog-based agent creation
// Step 1: Chat — user describes the agent
// Step 2: Preview — edit LLM-parsed config before confirming
// ============================================================

import { useState } from "react";
import type { AgentRow, ParsedAgentIntent } from "@agenthub/shared";
import { TOOL_SETS } from "@agenthub/shared";
import { parseCreationIntent, polishSystemPrompt, createAgentFromDraft } from "../../lib/api.js";

interface AgentCreationModalProps {
  onClose: () => void;
  onCreated: (agent: AgentRow) => void;
}

export function AgentCreationModal({ onClose, onCreated }: AgentCreationModalProps) {
  const [step, setStep] = useState<"chat" | "preview">("chat");
  const [description, setDescription] = useState("");
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState("");

  // Preview state
  const [parsed, setParsed] = useState<ParsedAgentIntent | null>(null);
  const [editedName, setEditedName] = useState("");
  const [editedSystemPrompt, setEditedSystemPrompt] = useState("");
  const [editedCapabilities, setEditedCapabilities] = useState<string[]>([]);
  const [editedToolSetIds, setEditedToolSetIds] = useState<string[]>([]);
  const [capInput, setCapInput] = useState("");
  const [polishing, setPolishing] = useState(false);
  const [creating, setCreating] = useState(false);

  const handleSend = async () => {
    const text = description.trim();
    if (!text) return;

    setParsing(true);
    setError("");
    try {
      const result = await parseCreationIntent(text);
      setParsed(result);
      setEditedName(result.name);
      setEditedSystemPrompt(result.systemPrompt);
      setEditedCapabilities(result.capabilities);
      setEditedToolSetIds(result.toolSetIds);
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "解析失败，请重试");
    } finally {
      setParsing(false);
    }
  };

  const addCapability = () => {
    const tag = capInput.trim();
    if (tag && !editedCapabilities.includes(tag)) {
      setEditedCapabilities((prev) => [...prev, tag]);
    }
    setCapInput("");
  };

  const removeCapability = (tag: string) => {
    setEditedCapabilities((prev) => prev.filter((c) => c !== tag));
  };

  const toggleToolSet = (id: string) => {
    setEditedToolSetIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const handlePolishing = async () => {
    if (!editedSystemPrompt.trim()) return;
    setPolishing(true);
    try {
      const result = await polishSystemPrompt(editedSystemPrompt);
      setEditedSystemPrompt(result.systemPrompt);
      if (result.capabilities.length > 0) {
        setEditedCapabilities((prev) => {
          const merged = new Set([...prev, ...result.capabilities]);
          return Array.from(merged);
        });
      }
    } catch (err) {
      console.error("Polish failed:", err);
    } finally {
      setPolishing(false);
    }
  };

  const handleConfirm = async () => {
    setCreating(true);
    try {
      const agent = await createAgentFromDraft({
        name: editedName.trim() || "Custom Agent",
        platform: parsed?.platform,
        systemPrompt: editedSystemPrompt,
        capabilities: editedCapabilities,
        toolSetIds: editedToolSetIds,
      });
      onCreated(agent);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
      setStep("chat");
    } finally {
      setCreating(false);
    }
  };

  const handleBack = () => {
    setStep("chat");
    setError("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800/95 backdrop-blur-md border border-gray-200 dark:border-gray-700/50 rounded-2xl p-6 w-[520px] shadow-2xl max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            {step === "chat" ? "新建 Agent" : "预览配置"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* STEP 1: Chat */}
        {step === "chat" && (
          <>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              描述你想要的 AI Agent，AI 会帮你生成配置。例如：
            </p>
            <div className="text-xs text-gray-400 dark:text-gray-500 mb-3 space-y-1">
              <p>• "帮我做一个擅长生成 PPT 的 Agent"</p>
              <p>• "我需要一个专门写 Python 后端代码的助手"</p>
              <p>• "创建一个能帮我调试 Bug 和写测试的 Agent"</p>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={4}
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:border-blue-500 resize-vertical"
              placeholder="描述你想要的 Agent..."
              autoFocus
            />
            {error && (
              <p className="text-xs text-red-500 mt-2">{error}</p>
            )}
            <div className="flex justify-end gap-3 mt-3">
              <button
                onClick={onClose}
                className="px-4 py-1.5 text-sm text-gray-600 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={handleSend}
                disabled={parsing || !description.trim()}
                className="px-4 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
              >
                {parsing ? "解析中..." : "生成配置"}
              </button>
            </div>
          </>
        )}

        {/* STEP 2: Preview */}
        {step === "preview" && parsed && (
          <>
            {/* Name */}
            <label className="block mb-3">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">名称</span>
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="mt-1 w-full px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:border-blue-500"
              />
            </label>

            {/* System Prompt */}
            <label className="block mb-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">System Prompt</span>
                <button
                  onClick={handlePolishing}
                  disabled={polishing || !editedSystemPrompt.trim()}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {polishing ? "✨ AI 润色中..." : "✨ AI 润色"}
                </button>
              </div>
              <textarea
                value={editedSystemPrompt}
                onChange={(e) => setEditedSystemPrompt(e.target.value)}
                rows={6}
                className="mt-1 w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200 focus:outline-none focus:border-blue-500 resize-vertical font-mono"
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
              {editedCapabilities.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {editedCapabilities.map((tag) => (
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
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">工具集（AI 已自动匹配）</span>
              <div className="grid grid-cols-2 gap-1.5 mt-1">
                {TOOL_SETS.map((ts) => {
                  const selected = editedToolSetIds.includes(ts.id);
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
                onClick={handleBack}
                disabled={creating}
                className="px-4 py-1.5 text-sm text-gray-600 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg disabled:opacity-50"
              >
                返回修改描述
              </button>
              <button
                onClick={handleConfirm}
                disabled={creating}
                className="px-4 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
              >
                {creating ? "创建中..." : "确认创建"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
