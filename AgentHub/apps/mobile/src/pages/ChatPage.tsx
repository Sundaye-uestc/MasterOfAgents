import { useEffect, useState, useCallback } from "react";
import type { MessageRow, AgentRow, ToolInvocationRow, ArtifactRow } from "@agenthub/shared";
import { useWebSocket } from "@agenthub/web/hooks/useWebSocket";
import type { ServerWsEvent } from "@agenthub/shared";
import { sendMessage, listAgents, getConversation, getConversationAgent, listMembers, stopRun as apiStopRun, listArtifactsByConversation } from "@agenthub/web/lib/api";
import { useMobileUIStore, permissionWsSender } from "../stores/mobile-ui.store.js";
import { useConversationStore } from "@agenthub/web/stores/conversation.store";
import { useMessageStore } from "@agenthub/web/stores/message.store";
import { useAgentStore } from "@agenthub/web/stores/agent.store";
import { useWorkspaceStore } from "@agenthub/web/stores/workspace.store";
import { useArtifactStore } from "@agenthub/web/stores/artifact.store";
import { useUserAvatar } from "@agenthub/web/hooks/useUserAvatar";
import { AgentBadge } from "@agenthub/web/components/chat/AgentBadge";
import { MobileMessageList } from "../components/mobile-chat/MobileMessageList.jsx";
import { MobilePinnedContext } from "../components/mobile-chat/MobilePinnedContext.jsx";
import { MobileMessageInput } from "../components/mobile-chat/MobileMessageInput.jsx";
import { MobileFileChangePopup } from "../components/mobile-chat/MobileFileChangePopup.jsx";
import { MobileMemberSheet } from "../components/mobile-chat/MobileMemberSheet.jsx";
import { RunStatusBanner } from "../components/mobile-run-status/RunStatusBanner.jsx";

interface MemberInfo {
  agentId: string;
  agentName: string;
  adapterKind: string;
  role?: string;
}

export function ChatPage() {
  const stack = useMobileUIStore((s) => s.stack);
  const pop = useMobileUIStore((s) => s.pop);
  const entry = stack[stack.length - 1];
  const conversationId = entry?.params?.conversationId as string;

  const loadMessages = useMessageStore((s) => s.load);
  const agentMap = useConversationStore((s) => s.agentMap);
  const agents = useAgentStore((s) => s.agents);
  const { avatar: userAvatar } = useUserAvatar();

  const [convTitle, setConvTitle] = useState("");
  const [convType, setConvType] = useState<"direct" | "group">("direct");
  const [convAgentId, setConvAgentId] = useState<string | null>(null);
  // Agent info for the member sheet (direct chat: fetched from API; group: from listMembers)
  const [convAgentInfo, setConvAgentInfo] = useState<MemberInfo | null>(null);
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<MessageRow[]>([]);
  const [memberCapabilities, setMemberCapabilities] = useState<Record<string, string[]>>({});

  // Local chat state (mirrors web ChatArea pattern)
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [toolInvocations, setToolInvocations] = useState<Record<string, ToolInvocationRow[]>>({});
  const [orchState, setOrchState] = useState<{
    runStatus: string;
    tasks: Array<{ taskId: string; agentId: string; title: string; status: string }>;
    progress: { completed: number; total: number };
  }>({ runStatus: "", tasks: [], progress: { completed: 0, total: 0 } });
  const [runArtifacts, setRunArtifacts] = useState<Record<string, ArtifactRow[]>>({});
  const [showFileChangePopup, setShowFileChangePopup] = useState(false);
  const [showMemberSheet, setShowMemberSheet] = useState(false);

  // Build nameMap: agentId → {agentName, adapterKind} for message bubble avatars
  const nameMap: Record<string, { agentId: string; agentName: string; adapterKind: string }> = {};
  const convAgent = agentMap[conversationId];
  if (convType === "group") {
    for (const m of members) {
      nameMap[m.agentId] = { agentId: m.agentId, agentName: m.agentName, adapterKind: m.adapterKind };
    }
  } else if (convAgent) {
    nameMap[convAgent.agentId] = convAgent;
  }
  // Fallback: fill in any missing agents from the agents store list
  for (const a of agents) {
    if (!nameMap[a.id]) {
      nameMap[a.id] = { agentId: a.id, agentName: a.name, adapterKind: a.adapterKind };
    }
  }

  // Load conversation info
  useEffect(() => {
    if (!conversationId) return;
    setMessages([]);  // clear while loading
    setShowFileChangePopup(false);  // reset popup on conversation switch
    loadMessages(conversationId).then(() => {
      // Sync store messages to local state after API completes
      const msgs = useMessageStore.getState().messages;
      setMessages(msgs);
    });
    useMessageStore.getState().loadPinned(conversationId).then(() => {
      setPinnedMessages(useMessageStore.getState().pinnedMessages);
    }).catch(() => {});

    getConversation(conversationId).then((c) => {
      setConvTitle(c.title);
      setConvType(c.type);
      // For direct chats, fetch the associated agent for the member sheet
      if (c.type === "direct") {
        getConversationAgent(conversationId).then(({ agentId }) => {
          if (agentId) setConvAgentId(agentId);
        }).catch(() => {});
      }
      // For group chats, load members — must be inside .then() because
      // the convType state is stale outside (setState hasn't flushed yet)
      if (c.type === "group") {
        listMembers(conversationId).then(setMembers).catch(() => {});
      }
    }).catch(() => {});

    // Load artifacts and group by runId with intra-run path dedup
    listArtifactsByConversation(conversationId).then((arts) => {
      const grouped: Record<string, ArtifactRow[]> = {};
      const sorted = [...arts].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      for (const art of sorted) {
        const rid = art.runId ?? "";
        if (!grouped[rid]) grouped[rid] = [];
        const existingIdx = grouped[rid]!.findIndex((a) => a.path === art.path);
        if (existingIdx >= 0) {
          grouped[rid]![existingIdx] = art; // replace with newer
        } else {
          grouped[rid]!.push(art);
        }
      }
      setRunArtifacts(grouped);
    }).catch(() => {});
  }, [conversationId, loadMessages]);

  // Load agents and capabilities (for both group and direct chats)
  useEffect(() => {
    if (agents.length === 0) useAgentStore.getState().load();
    const shouldLoad =
      (convType === "group" && members.length > 0) ||
      (convType === "direct" && !!(agentMap[conversationId] || convAgentId));
    if (shouldLoad) {
      listAgents().then((agentList) => {
        const map: Record<string, string[]> = {};
        for (const a of agentList) {
          if (a.capabilitiesJson) {
            try {
              const caps = JSON.parse(a.capabilitiesJson) as Array<{ label: string; value: string }>;
              map[a.id] = caps.map((c) => c.label ?? c.value ?? String(c)).slice(0, 5);
            } catch { map[a.id] = []; }
          } else {
            map[a.id] = [];
          }
        }
        setMemberCapabilities(map);
      }).catch(() => {});
    }
  }, [convType, members, agents.length, conversationId, agentMap, convAgentId]);

  // Once convAgentId is known and agents are loaded, resolve agent info for the member sheet
  useEffect(() => {
    if (convAgentId && !convAgentInfo) {
      const agent = agents.find((a) => a.id === convAgentId);
      if (agent) {
        setConvAgentInfo({
          agentId: agent.id,
          agentName: agent.name,
          adapterKind: agent.adapterKind,
        });
      }
    }
  }, [convAgentId, convAgentInfo, agents]);

  // WebSocket event handler
  const handleWsEvent = useCallback((raw: ServerWsEvent) => {
    const event = raw as any; // discriminated union narrowing is awkward for some event types
    switch (event.type) {
      case "message:created":
        setMessages((prev) => {
          if (prev.some((m) => m.id === event.message.id)) return prev;
          return [...prev, event.message as MessageRow];
        });
        break;
      case "message:delta":
        setMessages((prev) =>
          prev.map((m) =>
            m.id === event.messageId ? { ...m, content: (m.content || "") + event.delta, status: "streaming" } : m
          )
        );
        setStreamingMsgId(event.messageId);
        break;
      case "message:completed":
        setStreamingMsgId(null);
        setMessages((prev) =>
          prev.map((m) => (m.id === event.messageId ? { ...m, status: "sent" } : m))
        );
        break;
      case "run:started":
        setRunning(true);
        setCurrentRunId(event.runId);
        break;
      case "run:completed":
        setRunning(false);
        setCurrentRunId(null);
        // Show file-change popup if there are pending changes
        {
          const pending = useWorkspaceStore.getState().fileChanges.filter(
            (c) => c.status === "pending"
          );
          if (pending.length > 0) {
            setShowFileChangePopup(true);
          }
        }
        break;
      case "run:failed":
        setRunning(false);
        setCurrentRunId(null);
        break;
      case "run:status":
        setOrchState((prev) => ({
          ...prev,
          runStatus: event.status,
          progress: event.progress || prev.progress,
        }));
        break;
      case "task:started":
        setOrchState((prev) => ({
          ...prev,
          tasks: prev.tasks.map((t: any) =>
            t.taskId === event.taskId ? { ...t, status: "running" } : t
          ),
        }));
        break;
      case "task:completed":
        setOrchState((prev) => ({
          ...prev,
          tasks: prev.tasks.map((t: any) =>
            t.taskId === event.taskId ? { ...t, status: "completed" } : t
          ),
          progress: { ...prev.progress, completed: prev.progress.completed + 1 },
        }));
        break;
      case "task:failed":
        setOrchState((prev) => ({
          ...prev,
          tasks: prev.tasks.map((t: any) =>
            t.taskId === event.taskId ? { ...t, status: "failed" } : t
          ),
        }));
        break;
      case "orchestrator:plan_created":
        setOrchState((prev) => ({
          ...prev,
          tasks: event.plan?.tasks?.map((t: any) => ({ ...t, status: "queued" })) || [],
          progress: { completed: 0, total: event.plan?.tasks?.length || 0 },
        }));
        break;
      case "tool:invocation":
        setToolInvocations((prev) => {
          const list = prev[event.messageId] || [];
          const idx = list.findIndex((t: any) => t.id === event.invocation.id);
          if (idx >= 0) {
            const next = [...list];
            next[idx] = { ...next[idx], ...event.invocation } as ToolInvocationRow;
            return { ...prev, [event.messageId]: next };
          }
          return { ...prev, [event.messageId]: [...list, event.invocation as ToolInvocationRow] };
        });
        break;
      case "file:changed":
        if (event.conversationId === conversationId) {
          useWorkspaceStore.getState().updateFileChange(event.change);
        }
        break;
      case "artifact:created":
        // Update global artifact store
        useArtifactStore.setState((s: any) => {
          const exists = s.artifacts.some((a: any) => a.id === event.artifact.id);
          if (exists) return s;
          return { ...s, artifacts: [...s.artifacts, event.artifact] };
        });
        // Update per-run local state for inline preview cards
        setRunArtifacts((prev) => {
          const art = event.artifact as ArtifactRow;
          const runId = art.runId ?? "";
          const existing = prev[runId] ?? [];
          const samePathIdx = existing.findIndex((a) => a.path === art.path);
          if (samePathIdx >= 0) {
            const updated = [...existing];
            updated[samePathIdx] = art;
            return { ...prev, [runId]: updated };
          }
          return { ...prev, [runId]: [art, ...existing] };
        });
        break;
      case "permission:requested":
        useMobileUIStore.getState().push("approval", {
          runId: event.permission.runId,
          permissionId: event.permission.id,
          toolName: event.permission.toolName,
          description: event.permission.description,
        });
        break;
    }
  }, [conversationId]);

  // Connect WebSocket
  const { send: wsSend } = useWebSocket(conversationId, handleWsEvent);

  // Expose wsSend for ApprovalPage to send permission:respond messages
  useEffect(() => {
    permissionWsSender.send = wsSend;
    return () => { permissionWsSender.send = null; };
  }, [wsSend]);

  // Send handler
  const handleSend = useCallback(async (content: string, replyToId?: string, mentionedAgentId?: string) => {
    const tempId = `temp-${Date.now()}`;
    const tempMsg = {
      id: tempId,
      conversationId,
      role: "user" as const,
      content,
      agentId: null,
      runId: null,
      taskId: null,
      segmentsJson: null,
      metadataJson: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "sent" as const,
      replyToId: replyToId || null,
    } as MessageRow;

    setMessages((prev) => [...prev, tempMsg]);

    try {
      const effectiveAgentId = mentionedAgentId || convAgentId || undefined;
      const result = await sendMessage(conversationId, content, replyToId, effectiveAgentId);
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? (result.userMessage as MessageRow) : m))
      );
      if (result.runId) {
        setRunning(true);
        setCurrentRunId(result.runId);
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: "sent" as const } : m))
      );
    }
  }, [conversationId, convAgentId]);

  // Stop handler
  const handleStop = useCallback(async () => {
    if (!currentRunId) return;
    try {
      await apiStopRun(currentRunId);
      setRunning(false);
      setCurrentRunId(null);
    } catch {
      // ignore
    }
  }, [currentRunId]);

  const convAgentFromMap = agentMap[conversationId];

  // Build member list for the info sheet (group: real members; direct: single agent)
  const sheetMembers: MemberInfo[] =
    convType === "group"
      ? members
      : convAgentInfo  // state — reliably fetched via getConversationAgent
        ? [convAgentInfo]
        : convAgentFromMap  // fallback — may be populated from conversation store
          ? [convAgentFromMap]
          : [];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="flex items-center px-3 py-2 border-b border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 pt-safe" style={{ minHeight: "56px" }}>
        {/* Left: back button */}
        <button
          onClick={() => pop()}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 touch-target flex-shrink-0"
        >
          ←
        </button>

        {/* Center: title */}
        <h2 className="flex-1 text-center text-sm font-semibold text-gray-900 dark:text-gray-100 truncate px-1">
          {convTitle}
        </h2>

        {/* Right: running indicator + member menu */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {running && (
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 animate-pulse" />
          )}
          <button
            onClick={() => setShowMemberSheet(true)}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 touch-target"
          >
            ···
          </button>
        </div>
      </div>

      {/* Member info bottom sheet */}
      {showMemberSheet && (
        <MobileMemberSheet
          members={sheetMembers}
          capabilities={memberCapabilities}
          conversationType={convType}
          onClose={() => setShowMemberSheet(false)}
        />
      )}

      {/* Run status banner */}
      {running && (
        <RunStatusBanner
          runStatus={orchState.runStatus}
          tasks={orchState.tasks}
          progress={orchState.progress}
          onStop={handleStop}
        />
      )}

      {/* Pinned messages */}
      <MobilePinnedContext messages={pinnedMessages} onDismiss={() => setPinnedMessages([])} />

      {/* File change popup — outside scroll area so it stays visible */}
      {showFileChangePopup && (
        <MobileFileChangePopup onClose={() => setShowFileChangePopup(false)} />
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <MobileMessageList
          messages={messages}
          nameMap={nameMap}
          toolInvocations={toolInvocations}
          streamingMsgId={streamingMsgId}
          userAvatar={userAvatar}
          runArtifacts={runArtifacts}
        />
      </div>

      {/* Input bar */}
      <MobileMessageInput onSend={handleSend} onStop={handleStop} running={running} members={members} />
    </div>
  );
}
