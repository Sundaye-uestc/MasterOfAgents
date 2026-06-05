import { useEffect, useState, useRef, useCallback } from "react";
import type { MessageRow, FileChangeRow, ArtifactRow } from "@agenthub/shared";
import { listMessages, sendMessage, stopRun, deleteMessage, pinMessage, getPinnedMessages, retryMessage, listMembers, removeMember, listAgents, listArtifactsByConversation } from "../../lib/api.js";
import { useWebSocket } from "../../hooks/useWebSocket.js";
import type { WsServerEvent } from "../../hooks/useWebSocket.js";
import { useOrchestrationState } from "../../hooks/useOrchestrationState.js";
import { MessageInput } from "./MessageInput.js";
import { PermissionModal } from "./PermissionModal.js";

import { AgentBadge } from "./AgentBadge.js";
import { formatCapability } from "./CapabilityTags.js";
import { ToolInvocationCard } from "./ToolInvocationCard.js";
import { MessageBubble, isMessagePinned } from "./MessageBubble.js";
import { ReplyPreviewCard } from "./ReplyPreviewCard.js";
import { PinnedMessageBar } from "./PinnedMessageBar.js";
import { InlineDiffCard } from "./InlineDiffCard.js";
import { InlineArtifactCard } from "./InlineArtifactCard.js";
import { OrchestratorStatusBar } from "./OrchestratorStatusBar.js";
import { useWorkspaceStore } from "../../stores/workspace.store.js";

interface ToolInvocation {
  id: string;
  toolName: string;
  inputJson?: string;
  outputJson?: string;
  status: string;
}

interface MemberInfo {
  agentId: string;
  agentName: string;
  role: string;
  adapterKind: string;
}

interface Props {
  conversationId: string;
  onRefreshList: () => void;
  agentId?: string;
  conversationType?: "direct" | "group";
  conversationTitle?: string;
  adapterKind?: string;
  userAvatar?: string | null;
  scrollToRunId?: string | null;
  onManageMembers?: (convId: string) => void;
}

export function ChatArea({ conversationId, onRefreshList, agentId, conversationType, conversationTitle, adapterKind, userAvatar, scrollToRunId, onManageMembers }: Props) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [permRequest, setPermRequest] = useState<{
    permissionId: string;
    toolName: string;
    description: string;
    command?: string;
    runId: string;
  } | null>(null);
  const [orchBarExpanded, setOrchBarExpanded] = useState(false);
  const [agentCapabilities, setAgentCapabilities] = useState<string[]>([]);
  const [memberCapabilities, setMemberCapabilities] = useState<Record<string, string[]>>({});
  const [showMemberMenu, setShowMemberMenu] = useState(false);
  const memberMenuRef = useRef<HTMLDivElement>(null);
  const [toolInvocations, setToolInvocations] = useState<Record<string, ToolInvocation[]>>({});
  const [replyTo, setReplyTo] = useState<{
    messageId: string;
    content: string;
    role: string;
  } | null>(null);
  const [pinnedMessages, setPinnedMessages] = useState<MessageRow[]>([]);
  const [showPinnedBar, setShowPinnedBar] = useState(true);
  // Per-run caches for inline card display
  const [runFileChanges, setRunFileChanges] = useState<Record<string, FileChangeRow[]>>({});
  const [runArtifacts, setRunArtifacts] = useState<Record<string, ArtifactRow[]>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  // Workspace store for file changes
  const workspaceUpdateFileChange = useWorkspaceStore((s) => s.updateFileChange);

  const { state: orch, handleWsEvent: handleOrchEvent, reset: resetOrch } = useOrchestrationState();

  // Load members for group chats
  useEffect(() => {
    if (conversationType === "group") {
      listMembers(conversationId)
        .then(setMembers)
        .catch(() => {});
    } else {
      setMembers([]);
    }
  }, [conversationId, conversationType]);

  // Load agent capabilities for direct chats
  useEffect(() => {
    if (conversationType !== "group" && agentId) {
      listAgents()
        .then((agents) => {
          const agent = agents.find((a) => a.id === agentId);
          if (agent?.capabilitiesJson) {
            try {
              const caps = JSON.parse(agent.capabilitiesJson) as Array<{ label: string; value: string }>;
              setAgentCapabilities(caps.map((c) => c.label ?? c.value ?? c).slice(0, 5));
              return;
            } catch {}
          }
          setAgentCapabilities([]);
        })
        .catch(() => setAgentCapabilities([]));
    } else {
      setAgentCapabilities([]);
    }
  }, [conversationId, conversationType, agentId]);

  // Load agent capabilities for all group members (for member info dropdown)
  useEffect(() => {
    if (conversationType === "group" && members.length > 0) {
      listAgents()
        .then((agents) => {
          const map: Record<string, string[]> = {};
          for (const m of members) {
            const agent = agents.find((a) => a.id === m.agentId);
            if (agent?.capabilitiesJson) {
              try {
                const caps = JSON.parse(agent.capabilitiesJson) as Array<{ label: string; value: string }>;
                map[m.agentId] = caps.map((c) => c.label ?? c.value ?? c).slice(0, 4);
              } catch {
                map[m.agentId] = [];
              }
            } else {
              map[m.agentId] = [];
            }
          }
          setMemberCapabilities(map);
        })
        .catch(() => {});
    }
  }, [conversationId, conversationType, members]);

  // Close member menu on outside click
  useEffect(() => {
    if (!showMemberMenu) return;
    const handler = (e: MouseEvent) => {
      if (memberMenuRef.current && !memberMenuRef.current.contains(e.target as Node)) {
        setShowMemberMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMemberMenu]);

  // Load messages on mount / conversation change
  useEffect(() => {
    setLoading(true);
    setMessages([]);
    setStreamingMsgId(null);
    resetOrch();
    setPermRequest(null);
    setToolInvocations({});
    setPinnedMessages([]);
    setShowPinnedBar(true);
    setRunFileChanges({});
    setRunArtifacts({});
    listMessages(conversationId)
      .then((msgs) => {
        setMessages(msgs);
        setLoading(false);
        setTimeout(scrollToBottom, 100);
      })
      .catch(() => setLoading(false));
    getPinnedMessages(conversationId)
      .then(setPinnedMessages)
      .catch(() => {});
    listArtifactsByConversation(conversationId)
      .then((arts) => {
        const grouped: Record<string, ArtifactRow[]> = {};
        const sorted = [...arts].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        for (const art of sorted) {
          const rid = art.runId ?? "";
          if (!grouped[rid]) grouped[rid] = [];
          // Intra-run dedup by path (latest wins) — if two tasks within the same
          // orchestrated run touch the same file (e.g. Agent A creates, Agent B
          // refines), only show the latest version. Different runs each keep their
          // own copy so file preview refreshes across rounds.
          const existingIdx = grouped[rid]!.findIndex((a) => a.path === art.path);
          if (existingIdx >= 0) {
            grouped[rid]![existingIdx] = art; // replace with newer
          } else {
            grouped[rid]!.push(art);
          }
        }
        setRunArtifacts(grouped);
      })
      .catch(() => {});
  }, [conversationId]);

  // Scroll to message when snapshot expands — show the user's question too
  useEffect(() => {
    if (!scrollToRunId) return;
    const idx = messages.findIndex((m) => m.runId === scrollToRunId);
    if (idx === -1) return;
    // Scroll to the user message just before this agent response
    let targetIdx = idx;
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i]!.role === "user") { targetIdx = i; break; }
    }
    const el = document.getElementById(`message-${messages[targetIdx]!.id}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [scrollToRunId, messages]);

  // WebSocket for real-time events
  const onWsEvent = useCallback(
    (event: WsServerEvent) => {
      // Route orchestration events
      handleOrchEvent(event);

      switch (event.type) {
        case "message:created": {
          const msg = event.message as MessageRow;
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          setTimeout(scrollToBottom, 50);
          break;
        }
        case "message:delta":
          setStreamingMsgId(event.messageId);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === event.messageId
                ? { ...m, content: (m.content ?? "") + event.delta }
                : m
            )
          );
          setTimeout(scrollToBottom, 50);
          break;
        case "message:completed":
          setStreamingMsgId(null);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === event.messageId && m.status === "streaming"
                ? { ...m, status: "sent" as const }
                : m
            )
          );
          setRunning(false);
          setCurrentRunId(null);
          onRefreshList();
          break;
        case "run:started":
          setRunning(true);
          // Refresh workspace — ensureWorkspace may have just created it
          useWorkspaceStore.getState().load(conversationId);
          break;
        case "run:completed":
          console.log(`[ChatArea] 📥 WS run:completed — runId=${(event as any).runId}, triggering load()`);
          setRunning(false);
          setStreamingMsgId(null);
          setCurrentRunId(null);
          // Refresh workspace — agents may have modified files
          useWorkspaceStore.getState().load(conversationId);
          break;
        case "run:failed":
          setRunning(false);
          setStreamingMsgId(null);
          setCurrentRunId(null);
          break;
        case "permission:requested": {
          const perm = event.permission as any;
          setPermRequest({
            permissionId: perm.permissionId ?? perm.id ?? "",
            toolName: perm.toolName ?? "unknown",
            description: perm.description ?? "",
            command: perm.command,
            runId: perm.runId ?? "",
          });
          break;
        }
                case "tool:invocation": {
          const inv = (event as any).invocation;
          const msgId = (event as any).messageId as string;
          if (!inv || !msgId) break;
          if (inv.type === "tool_call") {
            setToolInvocations((prev) => {
              const list = prev[msgId] ?? [];
              const exists = list.some((t) => t.id === inv.toolCallId);
              if (exists) return prev;
              return {
                ...prev,
                [msgId]: [...list, {
                  id: inv.toolCallId,
                  toolName: inv.toolName,
                  inputJson: JSON.stringify(inv.input),
                  status: "running",
                }],
              };
            });
          } else if (inv.type === "tool_result") {
            setToolInvocations((prev) => {
              const list = prev[msgId];
              if (!list) return prev;
              return {
                ...prev,
                [msgId]: list.map((t) =>
                  t.id === inv.toolCallId
                    ? { ...t, outputJson: inv.output, status: inv.isError ? "error" : "success" }
                    : t
                ),
              };
            });
          }
          break;
        }
        case "file:changed": {
          const fc = (event as any).change as FileChangeRow;
          if (!fc) break;
          const wsEventConvId = (event as any).conversationId as string | undefined;
          if (wsEventConvId && wsEventConvId !== conversationId) break;
          console.log(`[ChatArea] 📥 WS file:changed — ${fc.changeType}:${fc.path} (id=${fc.id})`);
          workspaceUpdateFileChange(fc);
          // Also cache per-run for inline display
          // Cross-run dedup: if the same (path, changeType) already exists in
          // ANOTHER run's group, skip — this file was changed by a different agent
          // that finished earlier on the same workspace.
          setRunFileChanges((prev) => {
            const runId = fc.runId;
            const existing = prev[runId] ?? [];
            const idx = existing.findIndex((c) => c.id === fc.id);
            if (idx >= 0) {
              const updated = [...existing];
              updated[idx] = fc;
              return { ...prev, [runId]: updated };
            }
            // Intra-run dedup by (path, changeType) — avoid showing the
            // same file change twice within a single run.
            const sameKey = existing.find((c) => c.path === fc.path && c.changeType === fc.changeType);
            if (sameKey) return prev;
            return { ...prev, [runId]: [fc, ...existing] };
          });
          break;
        }
        case "artifact:created": {
          const art = (event as any).artifact as ArtifactRow;
          if (!art) break;
          setRunArtifacts((prev) => {
            const runId = art.runId ?? "";
            const existing = prev[runId] ?? [];
            // Intra-run dedup by path: replace older version of same file
            const samePathIdx = existing.findIndex((a) => a.path === art.path);
            if (samePathIdx >= 0) {
              const updated = [...existing];
              updated[samePathIdx] = art;
              return { ...prev, [runId]: updated };
            }
            return { ...prev, [runId]: [art, ...existing] };
          });
          break;
        }
        case "orchestrator:plan_created":
          setOrchBarExpanded(true);
          break;
      }
    },
    [onRefreshList, handleOrchEvent, workspaceUpdateFileChange, conversationId]
  );

  const { send: wsSend } = useWebSocket(conversationId, onWsEvent);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSend = useCallback(
    async (content: string, replyToId?: string, mentionedAgentIds?: string[]) => {
      const effectiveAgentId = mentionedAgentIds && mentionedAgentIds.length === 1 && !agentId
        ? mentionedAgentIds[0]
        : agentId;

      // Optimistic user message so it appears before any WS-delivered system/agent messages
      const tempUserMsg: MessageRow = {
        id: `temp-${Date.now()}`,
        conversationId,
        role: "user",
        content,
        status: "sending",
        runId: null,
        taskId: null,
        agentId: null,
        replyToId: replyToId ?? null,
        segmentsJson: null,
        metadataJson: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, tempUserMsg]);
      setTimeout(scrollToBottom, 50);

      try {
        const result = await sendMessage(conversationId, content, replyToId, effectiveAgentId);

        // Replace temp user message with real one from server
        setMessages((prev) => prev.map((m) => m.id === tempUserMsg.id ? result.userMessage : m));

        setReplyTo(null);
        setRunning(true);
        setCurrentRunId(result.runId);
        setTimeout(scrollToBottom, 100);
      } catch (err) {
        // Remove the temp message on failure
        setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
        console.error("Failed to send message", err);
      }
    },
    [conversationId, agentId]
  );

  const handleStop = useCallback(async () => {
    if (!currentRunId) return;
    try {
      await stopRun(currentRunId);
    } catch (err) {
      console.error("Failed to stop run", err);
    }
    setMessages((prev) =>
      prev.map((m) =>
        m.status === "streaming"
          ? { ...m, content: "", status: "error" as const }
          : m
      )
    );
    setRunning(false);
    setStreamingMsgId(null);
    setCurrentRunId(null);
    resetOrch();
  }, [currentRunId]);

  const handleDeleteMessage = useCallback(async (msgId: string) => {
    try {
      await deleteMessage(msgId);
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
    } catch (err) {
      console.error("Failed to delete message", err);
    }
  }, []);

  const handleReply = useCallback((msgId: string, content: string, role: string) => {
    setReplyTo({ messageId: msgId, content: content ?? "", role });
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyTo(null);
  }, []);

  const handlePinMessage = useCallback(async (msgId: string, pinned: boolean) => {
    try {
      await pinMessage(msgId, pinned);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? { ...m, metadataJson: pinned ? JSON.stringify({ pinned: true }) : null }
            : m
        )
      );
      getPinnedMessages(conversationId)
        .then(setPinnedMessages)
        .catch(() => {});
    } catch (err) {
      console.error("Failed to pin/unpin message", err);
    }
  }, [conversationId]);

  const handleScrollToMessage = useCallback((messageId: string) => {
    const el = document.getElementById(`message-${messageId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const handleRegenerate = useCallback(async (msgId: string) => {
    try {
      const result = await retryMessage(msgId);
      setRunning(true);
      setCurrentRunId(result.runId);
    } catch (err) {
      console.error("Failed to retry message", err);
    }
  }, []);

  const handleApprovePermission = useCallback(() => {
    if (!permRequest) return;
    wsSend({
      type: "permission:respond",
      runId: permRequest.runId,
      permissionId: permRequest.permissionId,
      approved: true,
    });
    setPermRequest(null);
  }, [permRequest, wsSend]);

  const handleDenyPermission = useCallback(() => {
    if (!permRequest) return;
    wsSend({
      type: "permission:respond",
      runId: permRequest.runId,
      permissionId: permRequest.permissionId,
      approved: false,
    });
    setPermRequest(null);
  }, [permRequest, wsSend]);

  // Multi-agent color mapping for messages
  const agentColor = (adapterKind: string) => {
    const colors: Record<string, string> = {
      "claude-code": "border-l-blue-500",
      codex: "border-l-green-500",
      opencode: "border-l-purple-500",
      custom: "border-l-yellow-500",
    };
    return colors[adapterKind] ?? "border-l-gray-500";
  };

  const getMemberInfo = (msgAgentId?: string | null) => {
    if (!msgAgentId || members.length === 0) return null;
    return members.find((m) => m.agentId === msgAgentId);
  };

  const isOrchestrating = orch.runId && orch.tasks.length > 0;

  // Get member count for group chats
  const memberCount = conversationType === "group" ? members.length : 0;

  return (
    <>
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-800/50 px-5 py-3 bg-gray-50 dark:bg-gray-900/80 backdrop-blur-sm flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-block w-2 h-2 bg-green-500 rounded-full flex-shrink-0 ring-2 ring-green-500/20" />
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
            {conversationType === "group"
              ? `${conversationTitle ?? "群聊"} (${memberCount})`
              : conversationTitle ?? "对话"}
          </h2>
          {/* Capability badges for direct chats */}
          {conversationType !== "group" && agentCapabilities.length > 0 && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {agentCapabilities.map((cap) => (
                <span
                  key={cap}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg text-[10px] bg-gray-100 dark:bg-gray-800/50 text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700/50"
                >
                  {formatCapability(cap)}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {conversationType === "group" && members.length > 0 && (
            <div className="flex items-center gap-1">
              {members.slice(0, 3).map((m) => (
                <AgentBadge key={m.agentId} agentName={m.agentName} adapterKind={m.adapterKind} size="sm" rounded="full" />
              ))}
              {members.length > 3 && (
                <span className="text-xs text-gray-400 dark:text-gray-600">+{members.length - 3}</span>
              )}
              {/* Member info dropdown */}
              <div className="relative" ref={memberMenuRef}>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowMemberMenu((v) => !v); }}
                  className="px-1 py-0.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded ml-0.5"
                >
                  ···
                </button>
                {showMemberMenu && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-gray-800/95 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 rounded-xl shadow-xl z-20 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700/50">
                      <span>群成员 · {members.length} 人</span>
                      <button
                        onClick={() => {
                          setShowMemberMenu(false);
                          onManageMembers?.(conversationId);
                        }}
                        className="flex-shrink-0 px-1.5 py-0.5 text-blue-500 hover:text-blue-400 font-medium rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                      >
                        ➕ 新增
                      </button>
                    </div>
                    {members.map((m) => {
                      const caps = memberCapabilities[m.agentId] ?? [];
                      return (
                        <div
                          key={m.agentId}
                          className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                        >
                          <AgentBadge agentName={m.agentName} adapterKind={m.adapterKind} size="sm" rounded="full" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                              {m.agentName}
                              {m.role === "host" && (
                                <span className="ml-1 text-[10px] text-blue-500 align-middle">👑</span>
                              )}
                            </div>
                            {caps.length > 0 && (
                              <div className="flex flex-wrap gap-0.5 mt-0.5">
                                {caps.map((cap) => (
                                  <span
                                    key={cap}
                                    className="inline-block px-1 py-0 text-[10px] rounded bg-gray-100 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400"
                                  >
                                    {formatCapability(cap)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              removeMember(conversationId, m.agentId)
                                .then(() => {
                                  setMembers((prev) => prev.filter((x) => x.agentId !== m.agentId));
                                  onRefreshList();
                                })
                                .catch(() => {});
                            }}
                            className="text-xs text-red-400 hover:text-red-600 dark:hover:text-red-300 flex-shrink-0 px-1.5 py-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          >
                            ❌️ 移除
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>
            </div>
          )}
          {running && (
            <span className="text-xs text-green-400">Agent 正在回复...</span>
          )}
        </div>
      </div>

      {/* Pinned messages bar */}
      {pinnedMessages.length > 0 && showPinnedBar && (
        <PinnedMessageBar
          messages={pinnedMessages}
          onScrollTo={handleScrollToMessage}
          onUnpin={(msgId) => handlePinMessage(msgId, false)}
          onClose={() => setShowPinnedBar(false)}
        />
      )}
      {pinnedMessages.length > 0 && !showPinnedBar && (
        <button
          onClick={() => setShowPinnedBar(true)}
          className="text-xs text-yellow-500 hover:text-yellow-400 px-4 py-1 border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800/50"
        >
          📌 {pinnedMessages.length} 条固定消息
        </button>
      )}

      {/* Orchestrator status bar */}
      {isOrchestrating && (
        <OrchestratorStatusBar
          runId={orch.runId!}
          status={orch.runStatus}
          tasks={orch.tasks}
          progress={orch.progress}
          expanded={orchBarExpanded}
          onToggle={() => setOrchBarExpanded((v) => !v)}
        />
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {loading && (
          <p className="text-center text-gray-400 dark:text-gray-600 text-sm">加载中...</p>
        )}

        {!loading && messages.length === 0 && (
          <p className="text-center text-gray-400 dark:text-gray-600 text-sm mt-12">
            发送消息开始对话
          </p>
        )}
        {messages.map((msg) => {
          const memberInfo = getMemberInfo(msg.agentId);
          const isUser = msg.role === "user";
          const isAgent = msg.role === "agent";
          const isSystem = msg.role === "system";

          const agentAdapterKind =
            memberInfo?.adapterKind ?? adapterKind ?? "custom";
          const agentName = memberInfo?.agentName ?? conversationTitle ?? "Agent";
          const showAgentName = conversationType === "group" && !!memberInfo;

          // System messages: centered, no avatar
          if (isSystem) {
            return (
              <div key={msg.id} id={`message-${msg.id}`} className="flex justify-center mb-4">
                <MessageBubble
                  message={msg}
                  isStreaming={msg.id === streamingMsgId}
                  onDelete={handleDeleteMessage}
                  onReply={handleReply}
                  onPin={handlePinMessage}
                  onRegenerate={handleRegenerate}
                />
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              id={`message-${msg.id}`}
              className={`flex items-start gap-2 mb-4 ${isUser ? "justify-end" : "justify-start"}`}
            >
              {/* Agent avatar on the LEFT */}
              {isAgent && (
                <AgentBadge
                  agentName={agentName}
                  adapterKind={agentAdapterKind}
                  size="lg"
                />
              )}

              {/* Message content column */}
              <div className="max-w-[75%]">
                {isAgent && showAgentName && (
                  <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">{agentName}</div>
                )}
                <MessageBubble
                  message={msg}
                  isStreaming={msg.id === streamingMsgId}
                  onDelete={handleDeleteMessage}
                  agentColor={isAgent ? agentColor(agentAdapterKind) : undefined}
                  onReply={handleReply}
                  onPin={handlePinMessage}
                  onRegenerate={handleRegenerate}
                />
                {/* Tool invocations for this agent message */}
                {isAgent && (() => {
                  const tools = toolInvocations[msg.id];
                  if (!tools || tools.length === 0) return null;
                  return (
                    <div className="mt-1 space-y-1">
                      {tools.map((tool) => (
                        <ToolInvocationCard key={tool.id} tool={tool} />
                      ))}
                    </div>
                  );
                })()}
                {isAgent && msg.runId && runFileChanges[msg.runId] && runFileChanges[msg.runId]!.length > 0 && null /* inline file changes removed — workspace panel covers this */}
                {/* Inline artifact cards (per-run, below agent message) */}
                {isAgent && msg.runId && runArtifacts[msg.runId] && runArtifacts[msg.runId]!.length > 0 && (
                  <div className="mt-1.5 space-y-1">
                    {runArtifacts[msg.runId]!.map((art) => (
                      <InlineArtifactCard key={art.id} artifact={art} />
                    ))}
                  </div>
                )}
              </div>

              {/* User avatar on the RIGHT */}
              {isUser && (
                userAvatar ? (
                  <img
                    src={userAvatar}
                    className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                    alt="用户头像"
                  />
                ) : (
                  <span className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-base flex-shrink-0 border border-gray-300 dark:border-gray-600">
                    👤
                  </span>
                )
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {replyTo && (
        <ReplyPreviewCard
          content={replyTo.content}
          role={replyTo.role}
          onCancel={handleCancelReply}
        />
      )}
      <MessageInput
        onSend={handleSend}
        disabled={running}
        onStop={handleStop}
        members={members}
        replyToId={replyTo?.messageId}
        onCancelReply={handleCancelReply}
      />

      {/* Permission modal */}
      <PermissionModal
        open={permRequest !== null}
        permission={permRequest}
        onApprove={handleApprovePermission}
        onDeny={handleDenyPermission}
      />

    </>
  );
}

