import { useState, useCallback, useEffect, useRef } from "react";
import { ConversationList, type AgentInfo } from "./components/chat/ConversationList.js";
import { ChatArea } from "./components/chat/ChatArea.js";
import { getConversationAgentsMap } from "./lib/api.js";
import { useUserAvatar } from "./hooks/useUserAvatar.js";
import type { ConversationRow } from "@agenthub/shared";

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

  const activeConversation = activeConversationId
    ? conversations.find((c) => c.id === activeConversationId)
    : undefined;

  const activeConversationType = activeConversation?.type as "direct" | "group" | undefined;

  // Compute title: agent name for direct chats, conversation title for groups
  const chatTitle = activeConversation
    ? (activeConversation.type === "group"
        ? activeConversation.title
        : agentMap[activeConversation.id]?.agentName)
    : undefined;

  const activeAdapterKind = activeConversationId
    ? agentMap[activeConversationId]?.adapterKind
    : undefined;

  const { avatar: userAvatar, uploadAvatar, clearAvatar } = useUserAvatar();
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const handleUploadAvatar = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      showToast("请选择图片文件", "error");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      showToast("图片过大，请选择小于 3MB 的文件", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const err = uploadAvatar(reader.result as string);
      if (err) {
        showToast(err, "error");
      } else {
        showToast("头像已上传", "success");
      }
    };
    reader.onerror = () => {
      showToast("读取图片失败，请重试", "error");
    };
    reader.readAsDataURL(file);
  }, [uploadAvatar, showToast]);

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
        {/* User avatar section */}
        <div className="border-t border-gray-800 p-3">
          <div className="flex items-center gap-3">
            <label className="cursor-pointer flex-shrink-0">
              {userAvatar ? (
                <img src={userAvatar} className="w-9 h-9 rounded-full object-cover border-2 border-gray-600" alt="用户头像" />
              ) : (
                <span className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center text-lg border-2 border-gray-600">
                  👤
                </span>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  handleUploadAvatar(file);
                  e.target.value = "";
                }}
              />
            </label>
            <div className="min-w-0">
              <p className="text-sm text-gray-300 truncate">我</p>
              {userAvatar ? (
                <button onClick={clearAvatar} className="text-xs text-gray-500 hover:text-gray-300">
                  移除头像
                </button>
              ) : (
                <p className="text-xs text-gray-500">点击上传头像</p>
              )}
            </div>
          </div>
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
            conversationType={activeConversationType}
            conversationTitle={chatTitle}
            adapterKind={activeAdapterKind}
            userAvatar={userAvatar}
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

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div
            className={`px-4 py-2 rounded-lg text-sm shadow-lg ${
              toast.type === "success"
                ? "bg-green-600 text-white"
                : "bg-red-600 text-white"
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
