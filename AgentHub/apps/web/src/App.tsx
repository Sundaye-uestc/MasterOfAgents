import { useState, useCallback, useEffect } from "react";
import { ConversationList, type AgentInfo } from "./components/chat/ConversationList.js";
import { ChatArea } from "./components/chat/ChatArea.js";
import { getConversationAgentsMap } from "./lib/api.js";
import type { ConversationRow, MessageRow } from "@agenthub/shared";

export function App() {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [agentMap, setAgentMap] = useState<Record<string, AgentInfo>>({});

  // Fetch agent map whenever conversations are loaded
  const refreshAgentMap = useCallback(() => {
    getConversationAgentsMap()
      .then(setAgentMap)
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshAgentMap();
  }, [conversations, refreshAgentMap]);

  const handleSelectConversation = useCallback((id: string) => {
    setActiveConversationId(id);
  }, []);

  const handleConversationCreated = useCallback(
    (conv: ConversationRow, agentId?: string) => {
      setConversations((prev) => [conv, ...prev]);
      setActiveConversationId(conv.id);
      // Optimistically update agent map
      if (agentId) {
        setAgentMap((prev) => ({
          ...prev,
          [conv.id]: {
            agentId,
            agentName: agentId === "default-codex" ? "Codex" : "Claude Code",
            adapterKind: agentId === "default-codex" ? "codex" : "claude-code",
          },
        }));
      }
    },
    []
  );

  const handleConversationsLoaded = useCallback((list: ConversationRow[]) => {
    setConversations(list);
  }, []);

  const handleRenameConversation = useCallback((id: string, title: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c))
    );
  }, []);

  const handlePinConversation = useCallback((id: string, pinned: boolean) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, pinnedAt: pinned ? new Date().toISOString() : null }
          : c
      )
    );
  }, []);

  const triggerRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
    refreshAgentMap();
  }, [refreshAgentMap]);

  const handleDeleteConversation = useCallback(
    (id: string) => {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      setAgentMap((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (activeConversationId === id) {
        setActiveConversationId(null);
      }
    },
    [activeConversationId]
  );

  const activeAgentId = activeConversationId
    ? agentMap[activeConversationId]?.agentId
    : undefined;

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-72 flex-shrink-0 border-r border-gray-800 bg-gray-900 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <h1 className="text-lg font-bold text-white">AgentHub</h1>
          <p className="text-xs text-gray-500 mt-0.5">Multi-Agent Collaboration</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          <ConversationList
            activeId={activeConversationId}
            onSelect={handleSelectConversation}
            conversations={conversations}
            onLoaded={handleConversationsLoaded}
            onConversationCreated={handleConversationCreated}
            onDelete={handleDeleteConversation}
            onRename={handleRenameConversation}
            onPin={handlePinConversation}
            agentMap={agentMap}
            onAgentMapLoaded={setAgentMap}
            refreshKey={refreshKey}
          />
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeConversationId ? (
          <ChatArea
            conversationId={activeConversationId}
            key={activeConversationId}
            onRefreshList={triggerRefresh}
            agentId={activeAgentId}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <p className="text-lg">选择一个对话或创建新的对话</p>
              <p className="text-sm mt-2">开始与 AI Agent 对话</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
