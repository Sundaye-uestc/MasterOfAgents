// ============================================================
// AgentManagePanel — management overlay with agent list & actions
// Includes: enable/disable, edit, detail, delete, right-click menu
// ============================================================

import { useState } from "react";
import type { AgentRow } from "@agenthub/shared";
import { AgentBadge } from "../chat/AgentBadge.js";
import { AgentCreationModal } from "./AgentCreationModal.js";
import { AgentEditModal } from "./AgentEditModal.js";
import { AgentDetailModal } from "./AgentDetailModal.js";
import { AgentDeleteConfirmModal } from "./AgentDeleteConfirmModal.js";
import { updateAgent, deleteAgent } from "../../lib/api.js";

interface AgentManagePanelProps {
  agents: AgentRow[];
  onClose: () => void;
  onAgentUpdated: () => void;
}

export function AgentManagePanel({ agents, onClose, onAgentUpdated }: AgentManagePanelProps) {
  const [creating, setCreating] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AgentRow | null>(null);
  const [detailAgent, setDetailAgent] = useState<AgentRow | null>(null);
  const [deletingAgent, setDeletingAgent] = useState<AgentRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    agentId: string;
    x: number;
    y: number;
  } | null>(null);

  // Filter: show all by default, but separate custom agents
  const customAgents = agents.filter((a) => a.isCustom === 1);
  const builtInAgents = agents.filter((a) => a.isCustom === 0);

  const handleToggleEnabled = async (agent: AgentRow) => {
    try {
      const newEnabled = agent.enabled === 1 ? false : true;
      await updateAgent(agent.id, { enabled: newEnabled });
      onAgentUpdated();
    } catch (err) {
      console.error("Toggle failed:", err);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, agentId: string) => {
    e.preventDefault();
    setContextMenu({ agentId, x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => setContextMenu(null);

  const handleEdit = (agent: AgentRow) => {
    closeContextMenu();
    setEditingAgent(agent);
  };

  const handleDetail = (agent: AgentRow) => {
    closeContextMenu();
    setDetailAgent(agent);
  };

  const handleDelete = (agent: AgentRow) => {
    closeContextMenu();
    setDeletingAgent(agent);
  };

  const confirmDelete = async () => {
    if (!deletingAgent) return;
    setDeleting(true);
    try {
      await deleteAgent(deletingAgent.id);
      onAgentUpdated();
      setDeletingAgent(null);
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setDeleting(false);
    }
  };

  const handleEditSave = async (data: {
    name: string;
    systemPrompt: string;
    capabilities: string[];
    toolSetIds: string[];
  }) => {
    if (!editingAgent) return;
    await updateAgent(editingAgent.id, data);
    onAgentUpdated();
    setEditingAgent(null);
  };

  const renderAgentRow = (agent: AgentRow) => {
    const capabilities: string[] = (() => {
      try {
        return JSON.parse(agent.capabilitiesJson ?? "[]") as string[];
      } catch {
        return [];
      }
    })();

    return (
      <div
        key={agent.id}
        onContextMenu={(e) => handleContextMenu(e, agent.id)}
        className={`flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors ${
          agent.enabled === 0 ? "opacity-50" : ""
        }`}
      >
        {/* Avatar + Name */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <AgentBadge
            agentName={agent.name}
            adapterKind={agent.adapterKind}
            avatar={agent.avatar ?? undefined}
            size="md"
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
              {agent.name}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 dark:text-gray-500">{agent.adapterKind}</span>
              {agent.isCustom === 1 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
                  自建
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Capability tags (max 2) */}
        {capabilities.length > 0 && (
          <div className="hidden sm:flex items-center gap-1 flex-shrink-0 max-w-[120px] overflow-hidden">
            {capabilities.slice(0, 2).map((cap) => (
              <span
                key={cap}
                className="px-1.5 py-0.5 text-[10px] rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 truncate"
              >
                {cap}
              </span>
            ))}
            {capabilities.length > 2 && (
              <span className="text-[10px] text-gray-400">+{capabilities.length - 2}</span>
            )}
          </div>
        )}

        {/* Enable/Disable Toggle */}
        <button
          onClick={() => handleToggleEnabled(agent)}
          className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
            agent.enabled === 1
              ? "bg-blue-500"
              : "bg-gray-300 dark:bg-gray-600"
          }`}
          title={agent.enabled === 1 ? "已启用，点击禁用" : "已禁用，点击启用"}
        >
          <span
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
              agent.enabled === 1 ? "left-4" : "left-0.5"
            }`}
          />
        </button>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => handleEdit(agent)}
            className="p-1 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
            title="编辑"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => handleDetail(agent)}
            className="p-1 text-gray-400 hover:text-green-500 dark:hover:text-green-400 transition-colors"
            title="查看详情"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
          {agent.isCustom === 1 && (
            <button
              onClick={() => handleDelete(agent)}
              className="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
              title="删除"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-10">
      <div className="bg-white dark:bg-gray-800/95 backdrop-blur-md border border-gray-200 dark:border-gray-700/50 rounded-2xl w-[640px] shadow-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700/50 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            ⚙️ Agent 管理
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCreating(true)}
              className="px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              + 新建 Agent
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none ml-2"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Custom Agents */}
          {customAgents.length > 0 && (
            <div>
              <div className="px-5 py-2 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                自建 Agent
              </div>
              {customAgents.map(renderAgentRow)}
            </div>
          )}

          {/* Built-in Agents */}
          {builtInAgents.length > 0 && (
            <div>
              <div className="px-5 py-2 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                内置 Agent
              </div>
              {builtInAgents.map(renderAgentRow)}
            </div>
          )}

          {agents.length === 0 && (
            <div className="px-5 py-12 text-center text-gray-400 dark:text-gray-500">
              <p className="text-lg mb-1">📭</p>
              <p className="text-sm">暂无 Agent</p>
            </div>
          )}
        </div>
      </div>

      {/* Sub-modals */}
      {creating && (
        <AgentCreationModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            onAgentUpdated();
          }}
        />
      )}

      {editingAgent && (
        <AgentEditModal
          agent={editingAgent}
          onClose={() => setEditingAgent(null)}
          onSave={handleEditSave}
        />
      )}

      {detailAgent && (
        <AgentDetailModal
          agent={detailAgent}
          onClose={() => setDetailAgent(null)}
        />
      )}

      {deletingAgent && (
        <AgentDeleteConfirmModal
          agent={deletingAgent}
          onClose={() => setDeletingAgent(null)}
          onConfirm={confirmDelete}
          loading={deleting}
        />
      )}

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={closeContextMenu} />
          <div
            className="fixed z-[70] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1 min-w-[140px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {(() => {
              const ctxAgent = agents.find((a) => a.id === contextMenu.agentId);
              if (!ctxAgent) return null;
              return (
                <>
                  <button
                    onClick={() => handleEdit(ctxAgent)}
                    className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    ✏️ 编辑
                  </button>
                  <button
                    onClick={() => handleDetail(ctxAgent)}
                    className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    👁️ 查看详情
                  </button>
                  <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
                  <button
                    onClick={() => {
                      closeContextMenu();
                      handleToggleEnabled(ctxAgent);
                    }}
                    className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    {ctxAgent.enabled === 1 ? "⏸️ 禁用" : "▶️ 启用"}
                  </button>
                  {ctxAgent.isCustom === 1 && (
                    <>
                      <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
                      <button
                        onClick={() => handleDelete(ctxAgent)}
                        className="w-full text-left px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        🗑️ 删除
                      </button>
                    </>
                  )}
                </>
              );
            })()}
          </div>
        </>
      )}
    </div>
  );
}
