import { useState, useCallback, useEffect, useRef } from "react";
import { ConversationList, type AgentInfo } from "./components/chat/ConversationList.js";
import { ChatArea } from "./components/chat/ChatArea.js";
import { WorkspacePanel } from "./components/workspace/WorkspacePanel.js";
import { getConversationAgentsMap } from "./lib/api.js";
import { useWorkspaceStore } from "./stores/workspace.store.js";
import { useUIStore } from "./stores/ui.store.js";
import { useUserAvatar } from "./hooks/useUserAvatar.js";
import { ThemeToggle } from "./components/ThemeToggle.js";
import { AgentManagePanel } from "./components/agent/AgentManagePanel.js";
import { useAgentStore } from "./stores/agent.store.js";
import type { ConversationRow } from "@agenthub/shared";

export function App() {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [agentMap, setAgentMap] = useState<Record<string, AgentInfo>>({});
  const [showAgentManage, setShowAgentManage] = useState(false);
  const [manageMembersConvId, setManageMembersConvId] = useState<string | null>(null);
  const agentStore = useAgentStore();

  const handleManageMembers = useCallback((convId: string) => {
    setManageMembersConvId(convId);
  }, []);

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

  const handleArchiveConversation = useCallback((id: string, archived: boolean) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, status: archived ? ("archived" as const) : ("active" as const) }
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

  // Workspace panel state — from Zustand store
  const workspaceFiles = useWorkspaceStore((s) => s.files);
  const workspaceSnapshots = useWorkspaceStore((s) => s.snapshots);
  const workspaceFileChanges = useWorkspaceStore((s) => s.fileChanges);
  const workspaceLoad = useWorkspaceStore((s) => s.load);
  const workspaceUpdateFileChange = useWorkspaceStore((s) => s.updateFileChange);

  // UI panel visibility
  const workspacePanelVisible = useUIStore((s) => s.activePanel === "workspace");
  const openPanel = useUIStore((s) => s.openPanel);
  const togglePanel = useUIStore((s) => s.togglePanel);

  // Load agents on mount — ensures agentStore is populated on refresh
  useEffect(() => {
    agentStore.load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load workspace data on conversation switch
  useEffect(() => {
    if (activeConversationId) {
      workspaceLoad(activeConversationId);
      openPanel("workspace");
    }
  }, [activeConversationId, workspaceLoad, openPanel]);

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
  const [scrollToRunId, setScrollToRunId] = useState<string | null>(null);
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
      <div className="w-72 flex-shrink-0 border-r border-gray-200 dark:border-gray-800/50 bg-white/95 dark:bg-gray-900/95 flex flex-col">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800/50">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">AgentHub</h1>
              <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">Multi-Agent Collaboration</p>
            </div>
            <ThemeToggle />
          </div>
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
            onArchive={handleArchiveConversation}
            agentMap={agentMap}
            onAgentMapLoaded={setAgentMap}
            refreshKey={refreshKey}
            userAvatar={userAvatar}
            manageMembersConvId={manageMembersConvId}
            onManageMembersClose={() => setManageMembersConvId(null)}
          />
        </div>
        {/* User + Agent management section */}
        <div className="border-t border-gray-200 dark:border-gray-800/50 px-4 py-3">
          <div className="flex items-center gap-2">
            {/* Left: User avatar */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <label className="cursor-pointer flex-shrink-0">
                {userAvatar ? (
                  <img src={userAvatar} className="w-8 h-8 rounded-full object-cover border-2 border-gray-300 dark:border-gray-600" alt="用户头像" />
                ) : (
                  <span className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-base border-2 border-gray-300 dark:border-gray-600">
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
                <p className="text-xs text-gray-700 dark:text-gray-300 truncate">我</p>
              </div>
            </div>

            {/* Vertical divider */}
            <div className="w-px h-8 bg-gray-300 dark:bg-gray-700 flex-shrink-0" />

            {/* Right: Agent management toggle */}
            <button
              onClick={() => setShowAgentManage(true)}
              className="flex items-center gap-1 flex-1 min-w-0 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg px-2 py-1 transition-colors"
            >
              <span className="text-sm flex-shrink-0">⚙️</span>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 whitespace-nowrap">Agent 管理 &gt;</p>
            </button>
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
            scrollToRunId={scrollToRunId}
            onManageMembers={handleManageMembers}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-gray-100/80 dark:bg-gray-800/50 flex items-center justify-center mx-auto text-2xl">💬</div>
              <p className="text-lg text-gray-400 dark:text-gray-500 font-medium">选择一个对话</p>
              <p className="text-sm text-gray-400 dark:text-gray-600">或创建新的对话开始与 AI Agent 协作</p>
            </div>
          </div>
        )}
      </div>

      {/* Workspace Panel — files, snapshots, file changes */}
      {activeConversationId && workspacePanelVisible && (
        <WorkspacePanel
          files={workspaceFiles}
          snapshots={workspaceSnapshots}
          fileChanges={workspaceFileChanges}
          onFileChangeUpdate={workspaceUpdateFileChange}
          onTogglePanel={() => togglePanel("workspace")}
          onNavigateToRun={(runId) => setScrollToRunId(runId)}
        />
      )}

      {/* Workspace toggle button (when panel is hidden) */}
      {activeConversationId && !workspacePanelVisible && (
        <button
          onClick={() => togglePanel("workspace")}
          className="absolute right-0 top-1/2 -translate-y-1/2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 rounded-l-xl px-1 py-3 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 z-10"
          title="显示工作区"
        >
          ◀
        </button>
      )}

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white/90 dark:bg-transparent rounded-2xl">
          <div
            className={`px-5 py-2.5 rounded-2xl text-sm shadow-xl ${
              toast.type === "success"
                ? "bg-green-500/90 dark:bg-green-500/90 text-white"
                : "bg-red-500/90 dark:bg-red-500/90 text-white"
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}

      {/* Agent Management Panel */}
      {showAgentManage && (
        <AgentManagePanel
          agents={agentStore.agents}
          onClose={() => setShowAgentManage(false)}
          onAgentUpdated={() => {
            agentStore.load();
          }}
        />
      )}
    </div>
  );
}
