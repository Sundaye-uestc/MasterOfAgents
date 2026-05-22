import { useEffect, useState, useRef } from "react";
import type { ConversationRow, AgentRow } from "@agenthub/shared";
import {
  listConversations,
  createConversation,
  deleteConversation,
  renameConversation,
  pinConversation,
  listAgents,
} from "../../lib/api.js";

export interface AgentInfo {
  agentId: string;
  agentName: string;
  adapterKind: string;
}

interface Props {
  activeId: string | null;
  onSelect: (id: string) => void;
  conversations: ConversationRow[];
  onLoaded: (list: ConversationRow[]) => void;
  onConversationCreated: (conv: ConversationRow, agentId?: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  agentMap: Record<string, AgentInfo>;
  onAgentMapLoaded: (map: Record<string, AgentInfo>) => void;
  refreshKey: number;
}

export function ConversationList({
  activeId,
  onSelect,
  conversations,
  onLoaded,
  onConversationCreated,
  onDelete,
  onRename,
  onPin,
  agentMap,
  onAgentMapLoaded,
  refreshKey,
}: Props) {
  const [search, setSearch] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newAgentId, setNewAgentId] = useState("default-claude");
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listConversations()
      .then(onLoaded)
      .catch(() => {});
  }, [refreshKey]);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    };
    if (menuOpenId) {
      document.addEventListener("mousedown", handler);
    }
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpenId]);

  // Auto-focus edit input
  useEffect(() => {
    if (editingId) {
      setTimeout(() => editInputRef.current?.focus(), 50);
    }
  }, [editingId]);

  const filtered = (search
    ? conversations.filter((c) =>
        c.title.toLowerCase().includes(search.toLowerCase())
      )
    : conversations
  ).sort((a, b) => {
    // Pinned first, then by updatedAt desc
    if (a.pinnedAt && !b.pinnedAt) return -1;
    if (!a.pinnedAt && b.pinnedAt) return 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });

  const handleNewClick = async () => {
    try {
      const list = await listAgents();
      setAgents(list);
    } catch { /* ignore */ }
    setShowNewModal(true);
    setNewTitle("");
    setNewAgentId("default-claude");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleConfirmCreate = async () => {
    const title = newTitle.trim() || "New Chat";
    setShowNewModal(false);
    try {
      const conv = await createConversation(title, "direct", newAgentId);
      onConversationCreated(conv, newAgentId);
    } catch (err) {
      console.error("Failed to create conversation", err);
    }
  };

  const handleDeleteClick = (id: string) => {
    setMenuOpenId(null);
    setConfirmDeleteId(id);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    try {
      await deleteConversation(id);
      onDelete(id);
    } catch (err) {
      console.error("Failed to delete conversation", err);
    }
  };

  const handleRenameClick = (conv: ConversationRow) => {
    setMenuOpenId(null);
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const handleRenameSave = async (id: string) => {
    const title = editTitle.trim();
    setEditingId(null);
    if (!title) return;
    try {
      await renameConversation(id, title);
      onRename(id, title);
    } catch (err) {
      console.error("Failed to rename conversation", err);
    }
  };

  const handlePinClick = async (id: string, pinned: boolean) => {
    setMenuOpenId(null);
    try {
      await pinConversation(id, pinned);
      onPin(id, pinned);
    } catch (err) {
      console.error("Failed to pin conversation", err);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3">
        <button
          onClick={handleNewClick}
          className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          + New Conversation
        </button>
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full mt-2 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-600"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.map((conv) => {
          const agent = agentMap[conv.id];
          const isEditing = editingId === conv.id;

          return (
            <div
              key={conv.id}
              className={`group flex items-center border-b border-gray-800/50 ${
                conv.id === activeId ? "bg-gray-800 border-l-2 border-l-blue-500" : ""
              }`}
            >
              <button
                onClick={() => !isEditing && onSelect(conv.id)}
                className="flex-1 text-left px-4 py-3 hover:bg-gray-800 transition-colors min-w-0"
              >
                <div className="flex items-center gap-2">
                  {agent && (
                    <AgentBadge
                      name={agent.agentName}
                      adapterKind={agent.adapterKind}
                    />
                  )}
                  {isEditing ? (
                    <input
                      ref={editInputRef}
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRenameSave(conv.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      onBlur={() => handleRenameSave(conv.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-gray-700 text-sm text-white px-1 py-0.5 rounded border border-blue-500 focus:outline-none w-full"
                    />
                  ) : (
                    <span className="text-sm font-medium text-gray-200 truncate">
                      {conv.pinnedAt && <span className="mr-1">📌</span>}
                      {conv.title}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 ml-7">
                  <span className="text-xs text-gray-500">
                    {conv.type === "direct" ? "Direct" : "Group"}
                  </span>
                  {conv.status === "archived" && (
                    <span className="text-xs text-yellow-600">Archived</span>
                  )}
                </div>
              </button>

              {/* Dropdown menu trigger */}
              <div className="relative" ref={menuOpenId === conv.id ? menuRef : null}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpenId(menuOpenId === conv.id ? null : conv.id);
                  }}
                  className="px-2 py-1 mr-1 text-gray-500 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity rounded hover:bg-gray-700"
                >
                  ···
                </button>
                {menuOpenId === conv.id && (
                  <div className="absolute right-0 top-full mt-1 w-32 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-10">
                    <button
                      onClick={() => handlePinClick(conv.id, !conv.pinnedAt)}
                      className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 rounded-t-md"
                    >
                      {conv.pinnedAt ? "📌 取消置顶" : "📌 置顶"}
                    </button>
                    <button
                      onClick={() => handleRenameClick(conv)}
                      className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700"
                    >
                      ✍️ 重命名
                    </button>
                    <div className="border-t border-gray-700" />
                    <button
                      onClick={() => handleDeleteClick(conv.id)}
                      className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-700 rounded-b-md"
                    >
                      🗑️ 删除
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-gray-600 text-sm mt-8">
            No conversations yet
          </p>
        )}
      </div>

      {/* New conversation modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 w-80 shadow-xl">
            <p className="text-sm text-gray-200 text-center mb-4">新建对话</p>

            <label className="block text-xs text-gray-400 mb-1">对话名称</label>
            <input
              ref={inputRef}
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirmCreate();
                if (e.key === "Escape") setShowNewModal(false);
              }}
              placeholder="输入对话名称"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />

            <label className="block text-xs text-gray-400 mb-1 mt-3">选择 Agent</label>
            <select
              value={newAgentId}
              onChange={(e) => setNewAgentId(e.target.value)}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-gray-200 focus:outline-none focus:border-blue-500"
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.adapterKind})
                </option>
              ))}
            </select>

            <div className="flex justify-center gap-3 mt-4">
              <button
                onClick={() => setShowNewModal(false)}
                className="px-4 py-1.5 text-sm text-gray-300 bg-gray-700 hover:bg-gray-600 rounded"
              >
                取消
              </button>
              <button
                onClick={handleConfirmCreate}
                className="px-4 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 w-80 shadow-xl">
            <p className="text-sm text-gray-200 text-center">
              对话删除后不可撤销！
            </p>
            <div className="flex justify-center gap-3 mt-4">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-1.5 text-sm text-gray-300 bg-gray-700 hover:bg-gray-600 rounded"
              >
                取消
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 text-sm text-white bg-red-600 hover:bg-red-700 rounded"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AgentBadge({ name, adapterKind }: { name: string; adapterKind: string }) {
  const logos: Record<string, string> = {
    "claude-code": "/agents/claude-code.png",
    codex: "/agents/codex.png",
  };

  const logoSrc = logos[adapterKind];

  if (logoSrc) {
    return (
      <img
        src={logoSrc}
        alt={name}
        className="w-5 h-5 rounded-full object-cover flex-shrink-0"
        title={name}
      />
    );
  }

  return (
    <span
      className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-600 text-white text-[10px] font-bold flex-shrink-0"
      title={name}
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}
