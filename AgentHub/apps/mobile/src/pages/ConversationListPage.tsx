import { useEffect, useState, useRef, useCallback } from "react";
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
} from "@agenthub/web/lib/api";
import { useConversationStore } from "@agenthub/web/stores/conversation.store";
import { useUserAvatar } from "@agenthub/web/hooks/useUserAvatar";
import { AgentBadge } from "@agenthub/web/components/chat/AgentBadge";
import { useMobileUIStore } from "../stores/mobile-ui.store.js";
import { MobileConversationItem } from "../components/mobile-chat/MobileConversationItem.jsx";
import { MobileConversationSearchBar } from "../components/mobile-chat/MobileConversationSearchBar.jsx";
import { MobileNewConversationModal } from "../components/mobile-chat/MobileNewConversationModal.jsx";

export function ConversationListPage() {
  const conversations = useConversationStore((s) => s.conversations);
  const agentMap = useConversationStore((s) => s.agentMap);
  const loadConversations = useConversationStore((s) => s.load);
  const { avatar: userAvatar } = useUserAvatar();

  const push = useMobileUIStore((s) => s.push);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [membersMap, setMembersMap] = useState<Record<string, Array<{ agentId: string; agentName: string; adapterKind: string }>>>({});

  // Manage members state
  const [manageMembersConvId, setManageMembersConvId] = useState<string | null>(null);
  const [manageMembersList, setManageMembersList] = useState<Array<{ agentId: string; agentName: string; role: string; adapterKind: string }>>([]);
  const [manageMembersAgents, setManageMembersAgents] = useState<AgentRow[]>([]);
  const [addMemberAgentId, setAddMemberAgentId] = useState("");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Fetch members for group conversations so we can show GroupAvatar (matches web)
  useEffect(() => {
    const groupConvs = conversations.filter((c) => c.type === "group");
    if (groupConvs.length === 0) return;
    Promise.all(
      groupConvs.map((c) =>
        listMembers(c.id)
          .then((m) => [c.id, m] as const)
          .catch(() => [c.id, []] as const)
      )
    ).then((pairs) => {
      const map: Record<string, Array<{ agentId: string; agentName: string; adapterKind: string }>> = {};
      for (const [id, m] of pairs) {
        map[id as string] = m as Array<{ agentId: string; agentName: string; adapterKind: string }>;
      }
      setMembersMap(map);
    });
  }, [conversations]);

  // Load data when manageMembersConvId changes
  useEffect(() => {
    if (!manageMembersConvId) return;
    Promise.all([listMembers(manageMembersConvId), listAgents()])
      .then(([members, agents]) => {
        setManageMembersList(members);
        setManageMembersAgents(agents);
        setAddMemberAgentId("");
      })
      .catch(() => {});
  }, [manageMembersConvId]);

  // Debounce search
  const handleSearch = useCallback((q: string) => {
    setSearch(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(q), 300);
  }, []);

  const handleSelect = useCallback(
    (id: string) => push("chat", { conversationId: id }),
    [push]
  );

  const handleCreate = useCallback(
    async (title: string, type: "direct" | "group", agentIds: string[]) => {
      const agentId = type === "direct" ? agentIds[0] : undefined;
      await createConversation(title, type, agentId, type === "group" ? agentIds : undefined);
      await loadConversations();
      setShowNewModal(false);
    },
    [loadConversations]
  );

  const handleDelete = useCallback(async (id: string) => {
    await deleteConversation(id);
    await loadConversations();
  }, [loadConversations]);

  const handleRename = useCallback(async (id: string, title: string) => {
    await renameConversation(id, title);
    await loadConversations();
    setEditingId(null);
  }, [loadConversations]);

  const handlePin = useCallback(async (id: string, pinned: boolean) => {
    await pinConversation(id, pinned);
    await loadConversations();
  }, [loadConversations]);

  const handleArchive = useCallback(async (id: string, archived: boolean) => {
    if (archived) await archiveConversation(id);
    else await unarchiveConversation(id);
    await loadConversations();
  }, [loadConversations]);

  const handleManageMembers = useCallback((convId: string) => {
    setManageMembersConvId(convId);
  }, []);

  const handleAddMember = useCallback(async () => {
    if (!manageMembersConvId || !addMemberAgentId) return;
    await addMember(manageMembersConvId, addMemberAgentId, "member");
    const members = await listMembers(manageMembersConvId);
    setManageMembersList(members);
    setAddMemberAgentId("");
  }, [manageMembersConvId, addMemberAgentId]);

  const handleRemoveMember = useCallback(async (agentId: string) => {
    if (!manageMembersConvId) return;
    await removeMember(manageMembersConvId, agentId);
    const members = await listMembers(manageMembersConvId);
    setManageMembersList(members);
  }, [manageMembersConvId]);

  const filtered = conversations
    .filter((c) => {
      if (!showArchived && c.status === "archived") return false;
      if (!debouncedSearch) return true;
      return c.title.toLowerCase().includes(debouncedSearch.toLowerCase());
    })
    .sort((a, b) => {
      if (a.pinnedAt && !b.pinnedAt) return -1;
      if (!a.pinnedAt && b.pinnedAt) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950 pt-safe">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-gray-200 dark:border-gray-800">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">AgentHub</h1>
        <button
          onClick={() => push("settings")}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 touch-target"
        >
          ⚙️
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <MobileConversationSearchBar value={search} onChange={handleSearch} />
      </div>

      {/* Archived toggle */}
      <div className="px-4 pb-2">
        <label className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 touch-target">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="rounded"
          />
          显示已归档
        </label>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-gray-400 dark:text-gray-600 text-sm">
            暂无会话
          </div>
        ) : (
          filtered.map((conv) => (
            <MobileConversationItem
              key={conv.id}
              conversation={conv}
              agentInfo={agentMap[conv.id]}
              members={membersMap[conv.id]}
              userAvatar={userAvatar}
              isSelected={false}
              editingId={editingId}
              editTitle={editTitle}
              onEditTitle={setEditTitle}
              onStartEdit={(id) => { setEditingId(id); setEditTitle(conv.title); }}
              onCancelEdit={() => setEditingId(null)}
              onSaveEdit={(id) => handleRename(id, editTitle)}
              onSelect={handleSelect}
              onDelete={handleDelete}
              onPin={handlePin}
              onArchive={handleArchive}
              onManageMembers={handleManageMembers}
            />
          ))
        )}
      </div>

      {/* FAB — New conversation */}
      <button
        onClick={() => setShowNewModal(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-2xl shadow-lg flex items-center justify-center text-2xl active:bg-blue-700 z-10 touch-target"
        style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        +
      </button>

      {/* New conversation modal */}
      {showNewModal && (
        <MobileNewConversationModal
          onClose={() => setShowNewModal(false)}
          onCreate={handleCreate}
        />
      )}

      {/* Manage members modal */}
      {manageMembersConvId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setManageMembersConvId(null)}>
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl w-[90vw] max-h-[80vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">管理成员</h2>
              <button onClick={() => setManageMembersConvId(null)} className="w-8 h-8 flex items-center justify-center text-gray-400 touch-target">✕</button>
            </div>

            <div className="px-4 py-4 space-y-4">
              {/* Member list */}
              <div>
                <h3 className="text-xs font-medium text-gray-500 mb-2">当前成员 ({manageMembersList.length})</h3>
                <div className="space-y-1">
                  {manageMembersList.map((m) => (
                    <div key={m.agentId} className="flex items-center gap-2 py-2 px-2 rounded-lg">
                      <AgentBadge agentName={m.agentName} adapterKind={m.adapterKind} size="sm" rounded="full" />
                      <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">{m.agentName}</span>
                      {m.role === "host" && <span className="text-xs text-yellow-500">👑</span>}
                      <button
                        onClick={() => handleRemoveMember(m.agentId)}
                        className="text-xs text-red-500 px-2 py-1 rounded touch-target"
                      >
                        ❌
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add member */}
              <div>
                <h3 className="text-xs font-medium text-gray-500 mb-2">添加成员</h3>
                <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                  {manageMembersAgents.length === 0 ? (
                    <div className="p-4 text-sm text-gray-400 text-center">加载中...</div>
                  ) : (
                    manageMembersAgents.map((agent) => {
                      const alreadyMember = manageMembersList.some((m) => m.agentId === agent.id);
                      const isSelected = addMemberAgentId === agent.id;
                      return (
                        <button
                          key={agent.id}
                          onClick={() => alreadyMember ? null : setAddMemberAgentId(isSelected ? "" : agent.id)}
                          disabled={alreadyMember}
                          className={`w-full flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0 touch-target ${
                            alreadyMember ? "opacity-40" : isSelected ? "bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500 rounded-lg" : "active:bg-gray-50 dark:active:bg-gray-800/50"
                          }`}
                        >
                          <AgentBadge agentName={agent.name} adapterKind={agent.adapterKind} size="sm" rounded="md" />
                          <div className="flex-1 text-left">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{agent.name}</div>
                            <div className="text-xs text-gray-500">{agent.adapterKind}</div>
                          </div>
                          {alreadyMember && <span className="text-xs text-gray-400">已加入</span>}
                          {isSelected && <span className="text-blue-600 text-sm">✓</span>}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setManageMembersConvId(null)}
                  className="flex-1 py-3 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium touch-target"
                >
                  关闭
                </button>
                <button
                  onClick={handleAddMember}
                  disabled={!addMemberAgentId}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 touch-target"
                >
                  添加
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
