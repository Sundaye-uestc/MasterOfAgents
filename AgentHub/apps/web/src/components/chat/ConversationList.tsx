import { useEffect, useState, useRef } from "react";
import type { ConversationRow, AgentRow } from "@agenthub/shared";
import {
  listConversations,
  createConversation,
  deleteConversation,
  renameConversation,
  pinConversation,
  archiveConversation,
  unarchiveConversation,
  listAgents,
  listMembers,
  addMember,
  removeMember,
} from "../../lib/api.js";
import { AgentPicker } from "./AgentPicker.js";
import { AgentBadge } from "./AgentBadge.js";

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
  onArchive: (id: string, archived: boolean) => void;
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
  onArchive,
  agentMap,
  onAgentMapLoaded,
  refreshKey,
}: Props) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newRootPath, setNewRootPath] = useState("D:/Projects/MasterOfAgents/Test");
  const [newAgentId, setNewAgentId] = useState("default-claude");
  const [isGroupChat, setIsGroupChat] = useState(false);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [manageMembersConvId, setManageMembersConvId] = useState<string | null>(null);
  const [manageMembersList, setManageMembersList] = useState<Array<{ agentId: string; agentName: string; role: string; adapterKind: string }>>([]);
  const [manageMembersAgents, setManageMembersAgents] = useState<AgentRow[]>([]);
  const [addMemberAgentId, setAddMemberAgentId] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  useEffect(() => {
    listConversations(debouncedSearch || undefined)
      .then(onLoaded)
      .catch(() => {});
  }, [refreshKey, debouncedSearch]);

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

  const filtered = conversations
    .filter((c) => showArchived || c.status !== "archived")
    .sort((a, b) => {
      if (a.status === "archived" && b.status !== "archived") return 1;
      if (a.status !== "archived" && b.status === "archived") return -1;
      if (a.pinnedAt && !b.pinnedAt) return -1;
      if (!a.pinnedAt && b.pinnedAt) return 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });

  const handleNewClick = async () => {
    try {
      const list = await listAgents(true);
      setAgents(list);
    } catch { /* ignore */ }
    setShowNewModal(true);
    setNewTitle("");
    setNewRootPath("D:/Projects/MasterOfAgents/Test");
    setNewAgentId("default-claude");
    setIsGroupChat(false);
    setSelectedAgentIds([]);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleConfirmCreate = async () => {
    const title = newTitle.trim() || "New Chat";
    setShowNewModal(false);
    try {
      const rootPath = newRootPath.trim() || undefined;
      if (isGroupChat) {
        const ids = selectedAgentIds.length > 0 ? selectedAgentIds : [newAgentId];
        const conv = await createConversation(title, "group", undefined, ids, rootPath);
        onConversationCreated(conv, ids[0]);
      } else {
        const conv = await createConversation(title, "direct", newAgentId, undefined, rootPath);
        onConversationCreated(conv, newAgentId);
      }
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

  const handleArchiveClick = async (convId: string, archive: boolean) => {
    setMenuOpenId(null);
    try {
      if (archive) {
        await archiveConversation(convId);
      } else {
        await unarchiveConversation(convId);
      }
      onArchive(convId, archive);
    } catch (err) {
      console.error("Failed to archive/unarchive conversation", err);
    }
  };

  const handleManageMembers = async (convId: string) => {
    setMenuOpenId(null);
    try {
      const [members, agents] = await Promise.all([listMembers(convId), listAgents()]);
      setManageMembersConvId(convId);
      setManageMembersList(members);
      setManageMembersAgents(agents);
      setAddMemberAgentId("");
    } catch (err) {
      console.error("Failed to load members", err);
    }
  };

  const handleAddMember = async () => {
    if (!manageMembersConvId || !addMemberAgentId) return;
    try {
      await addMember(manageMembersConvId, addMemberAgentId);
      const members = await listMembers(manageMembersConvId);
      setManageMembersList(members);
      setAddMemberAgentId("");
    } catch (err) {
      console.error("Failed to add member", err);
    }
  };

  const handleRemoveMember = async (agentId: string) => {
    if (!manageMembersConvId) return;
    try {
      await removeMember(manageMembersConvId, agentId);
      setManageMembersList((prev) => prev.filter((m) => m.agentId !== agentId));
    } catch (err) {
      console.error("Failed to remove member", err);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3">
        <button
          onClick={handleNewClick}
          className="w-full py-2 px-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium transition-colors"
        >
          + 新建对话
        </button>
        <input
          type="text"
          placeholder="搜索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full mt-2 px-3 py-2 bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 rounded-xl text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500/30"
        />
        <label className="flex items-center gap-2 px-1 py-1 text-xs text-gray-400 dark:text-gray-500 cursor-pointer mt-1">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="rounded bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600"
          />
          显示已归档
        </label>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.map((conv) => {
          const agent = agentMap[conv.id];
          const isEditing = editingId === conv.id;

          return (
            <div
              key={conv.id}
              className={`group flex items-center border-b border-gray-200 dark:border-gray-800/30 px-2 ${
                conv.id === activeId ? "bg-blue-500/10 rounded-lg" : ""
              }`}
            >
              <button
                onClick={() => !isEditing && onSelect(conv.id)}
                className="flex-1 text-left px-2 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-800/30 rounded-lg transition-colors min-w-0"
              >
                <div className="flex items-center gap-2">
                  {agent && (
                    <AgentBadge
                      agentName={agent.agentName}
                      adapterKind={agent.adapterKind}
                      size="sm"
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
                      className="bg-gray-100 dark:bg-gray-700 text-sm text-gray-900 dark:text-white px-1 py-0.5 rounded border border-blue-500 focus:outline-none w-full"
                    />
                  ) : (
                    <span className="text-sm text-gray-700 dark:text-gray-200 truncate">
                      {conv.pinnedAt && <span className="mr-1">📌</span>}
                      {conv.title}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 ml-7">
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {conv.type === "direct" ? "单聊" : "群聊"}
                  </span>
                  {conv.status === "archived" && (
                    <span className="text-xs text-yellow-600">已归档</span>
                  )}
                </div>
              </button>

              {/* Dropdown menu — always visible */}
              <div className="relative" ref={menuOpenId === conv.id ? menuRef : null}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpenId(menuOpenId === conv.id ? null : conv.id);
                  }}
                  className="px-2 py-1 mr-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-gray-700/50 rounded-lg"
                >
                  ···
                </button>
                {menuOpenId === conv.id && (
                  <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-gray-800/95 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 rounded-xl shadow-xl z-10 overflow-hidden">
                    <button
                      onClick={() => handlePinClick(conv.id, !conv.pinnedAt)}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700/50"
                    >
                      {conv.pinnedAt ? "📌 取消置顶" : "📌 置顶"}
                    </button>
                    <button
                      onClick={() => handleRenameClick(conv)}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700/50"
                    >
                      ✍️ 重命名
                    </button>
                    {conv.type === "group" && (
                      <>
                        <div className="border-t border-gray-200 dark:border-gray-700/50" />
                        <button
                          onClick={() => handleManageMembers(conv.id)}
                          className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700/50"
                        >
                          👥 管理成员
                        </button>
                      </>
                    )}
                    <div className="border-t border-gray-200 dark:border-gray-700/50" />
                    {conv.status === "archived" ? (
                      <button
                        onClick={() => handleArchiveClick(conv.id, false)}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700/50"
                      >
                        📂 取消归档
                      </button>
                    ) : (
                      <button
                        onClick={() => handleArchiveClick(conv.id, true)}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                      >
                        📦 归档
                      </button>
                    )}
                    <div className="border-t border-gray-200 dark:border-gray-700" />
                    <button
                      onClick={() => handleDeleteClick(conv.id)}
                      className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-b-md"
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
          <p className="text-center text-gray-400 dark:text-gray-600 text-sm mt-8">
            暂无对话
          </p>
        )}
      </div>

      {/* New conversation modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800/95 backdrop-blur-md border border-gray-200 dark:border-gray-700/50 rounded-2xl p-6 w-96 shadow-2xl max-h-[80vh] overflow-y-auto">
            <p className="text-sm text-gray-700 dark:text-gray-200 text-center mb-4">新建对话</p>

            {/* Chat type toggle */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => { setIsGroupChat(false); setSelectedAgentIds([]); }}
                className={`flex-1 py-1.5 text-sm rounded-lg border transition-colors ${
                  !isGroupChat ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300" : "border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                单聊
              </button>
              <button
                onClick={() => setIsGroupChat(true)}
                className={`flex-1 py-1.5 text-sm rounded-lg border transition-colors ${
                  isGroupChat ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300" : "border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                群聊
              </button>
            </div>

            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">对话名称</label>
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
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />

            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1 mt-3">
              工作目录 <span className="text-gray-400 dark:text-gray-600">（可选，留空则使用默认目录）</span>
            </label>
            <input
              type="text"
              value={newRootPath}
              onChange={(e) => setNewRootPath(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirmCreate();
                if (e.key === "Escape") setShowNewModal(false);
              }}
              placeholder="例: D:\Projects\MyWorkDir"
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono"
            />

            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1 mt-3">
              {isGroupChat ? "选择多个 Agent" : "选择 Agent"}
            </label>
            {isGroupChat ? (
              <AgentPicker
                agents={agents}
                selectedIds={selectedAgentIds}
                onChange={setSelectedAgentIds}
                multiSelect
              />
            ) : (
              <AgentPicker
                agents={agents}
                selectedIds={[newAgentId]}
                onChange={(ids) => { if (ids.length > 0) setNewAgentId(ids[0]!); }}
              />
            )}

            <div className="flex justify-center gap-3 mt-4">
              <button
                onClick={() => setShowNewModal(false)}
                className="px-4 py-1.5 text-sm text-gray-600 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded"
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
          <div className="bg-white dark:bg-gray-800/95 backdrop-blur-md border border-gray-200 dark:border-gray-700/50 rounded-2xl p-6 w-80 shadow-2xl">
            <p className="text-sm text-gray-700 dark:text-gray-200 text-center">
              对话删除后不可撤销！
            </p>
            <div className="flex justify-center gap-3 mt-4">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-1.5 text-sm text-gray-600 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded"
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

      {/* Manage members modal */}
      {manageMembersConvId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800/95 backdrop-blur-md border border-gray-200 dark:border-gray-700/50 rounded-2xl p-6 w-96 shadow-2xl max-h-[80vh] overflow-y-auto">
            <p className="text-sm text-gray-700 dark:text-gray-200 text-center mb-4">管理群成员</p>

            {/* Current members */}
            <div className="mb-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">当前成员 ({manageMembersList.length})</p>
              {manageMembersList.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-600">暂无成员</p>
              ) : (
                <div className="space-y-1.5">
                  {manageMembersList.map((m) => (
                    <div
                      key={m.agentId}
                      className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
                    >
                      <div className="flex items-center gap-2">
                        <AgentBadge
                          agentName={m.agentName}
                          adapterKind={m.adapterKind}
                          size="sm"
                        />
                        <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">{m.role}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveMember(m.agentId)}
                        className="text-xs text-red-400 hover:text-red-300 hover:bg-gray-200 dark:hover:bg-gray-700 px-2 py-1 rounded transition-colors"
                      >
                        移除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add member */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">添加成员</p>
              <div className="flex gap-2">
                <select
                  value={addMemberAgentId}
                  onChange={(e) => setAddMemberAgentId(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="">选择 Agent...</option>
                  {manageMembersAgents
                    .filter((a) => !manageMembersList.some((m) => m.agentId === a.id))
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.adapterKind})
                      </option>
                    ))}
                </select>
                <button
                  onClick={handleAddMember}
                  disabled={!addMemberAgentId}
                  className="px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  添加
                </button>
              </div>
            </div>

            <div className="flex justify-center mt-4">
              <button
                onClick={() => setManageMembersConvId(null)}
                className="px-4 py-1.5 text-sm text-gray-600 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
