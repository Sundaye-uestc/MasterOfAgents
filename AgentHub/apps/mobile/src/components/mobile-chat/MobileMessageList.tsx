import { useEffect, useRef } from "react";
import type { MessageRow, ToolInvocationRow, ArtifactRow } from "@agenthub/shared";
import { MobileMessageBubble } from "./MobileMessageBubble.jsx";
import { ToolInvocationList } from "../mobile-run-status/ToolInvocationList.jsx";
import { MobileInlineArtifactCard } from "../mobile-artifact/MobileInlineArtifactCard.jsx";

interface AgentInfo {
  agentId: string;
  agentName: string;
  adapterKind: string;
  avatar?: string | null;
}

interface Props {
  messages: MessageRow[];
  nameMap: Record<string, AgentInfo>;
  toolInvocations?: Record<string, ToolInvocationRow[]>;
  streamingMsgId?: string | null;
  userAvatar?: string | null;
  runArtifacts?: Record<string, ArtifactRow[]>;
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const msgDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (msgDate.getTime() === today.getTime()) return "今天";
  if (msgDate.getTime() === yesterday.getTime()) return "昨天";
  return d.toLocaleDateString("zh-CN", { month: "long", day: "numeric" });
}

export function MobileMessageList({ messages, nameMap, toolInvocations, streamingMsgId, userAvatar, runArtifacts }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-600 text-sm py-20">
        暂无消息
      </div>
    );
  }

  // Build per-round artifact ownership maps.  Each user message starts
  // a new round.  Within each round, the agent with the earliest createdAt
  // for a given filename "owns" that file — shown only under that agent.
  const perRoundOwnerMaps: Array<Map<string, string>> = []; // filename → runId
  {
    const userIndices: number[] = [];
    messages.forEach((m, i) => { if (m.role === "user") userIndices.push(i); });
    for (let r = 0; r < userIndices.length; r++) {
      const roundStart = userIndices[r]!;
      const roundEnd = r + 1 < userIndices.length ? userIndices[r + 1]! : messages.length;
      const roundRunIds = new Set<string>();
      for (let j = roundStart + 1; j < roundEnd; j++) {
        const m = messages[j];
        if (m && m.role === "agent" && m.runId) roundRunIds.add(m.runId);
      }
      const ownerMap = new Map<string, string>();
      const all: Array<{ art: ArtifactRow; runId: string }> = [];
      for (const [runId, arts] of Object.entries(runArtifacts ?? {})) {
        if (!roundRunIds.has(runId)) continue;
        for (const art of arts) all.push({ art, runId });
      }
      all.sort((a, b) =>
        new Date(a.art.createdAt).getTime() - new Date(b.art.createdAt).getTime()
      );
      for (const { art, runId } of all) {
        if (!ownerMap.has(art.name)) ownerMap.set(art.name, runId);
      }
      perRoundOwnerMaps.push(ownerMap);
    }
  }

  // Per-round filename dedup (reset on each user message).
  const shownInThisRound = new Set<string>();
  let currentRoundIndex = -1;

  // Group messages by date
  let lastDateLabel = "";

  return (
    <div ref={containerRef} className="px-3 py-4 space-y-1">
      {messages.map((msg, i) => {
        const dateLabel = formatDateLabel(msg.createdAt);
        const showDateLabel = dateLabel !== lastDateLabel;
        lastDateLabel = dateLabel;

        const prevMsg: MessageRow | undefined = i > 0 ? messages[i - 1] : undefined;
        const showSender = !prevMsg || prevMsg.role !== msg.role || prevMsg.agentId !== msg.agentId;

        // Each user message starts a new round — advance round index + reset dedup
        if (msg.role === "user") {
          currentRoundIndex++;
          shownInThisRound.clear();
        }

        return (
          <div key={msg.id}>
            {showDateLabel && (
              <div className="flex justify-center my-3">
                <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">
                  {dateLabel}
                </span>
              </div>
            )}
            <MobileMessageBubble
              message={msg}
              agentInfo={msg.agentId ? nameMap[msg.agentId] : undefined}
              showSender={showSender}
              isStreaming={streamingMsgId === msg.id}
              userAvatar={userAvatar}
            />
            {/* Inline artifact preview cards — only show artifacts produced by THIS message */}
            {msg.role === "agent" && msg.runId && runArtifacts?.[msg.runId] && (() => {
              const arts = runArtifacts[msg.runId]!;
              const own = arts.filter((a) => {
                    // Only show artifacts that "belong" to this agent
                    // within the current round (earliest createdAt wins).
                    const ownerMap = perRoundOwnerMaps[currentRoundIndex];
                    if (ownerMap && ownerMap.get(a.name) !== msg.runId) return false;
                    // Per-round dedup: same filename only once per round.
                    if (shownInThisRound.has(a.name)) return false;
                    shownInThisRound.add(a.name);
                    return true;
                  });
              if (own.length === 0) return null;
              return (
                <div className="ml-10 max-w-[85%] space-y-1">
                  {own.map((art) => (
                    <MobileInlineArtifactCard key={art.id} artifact={art} />
                  ))}
                </div>
              );
            })()}
            {toolInvocations?.[msg.id] && toolInvocations[msg.id]!.length > 0 && (
              <div className="ml-10 mt-1">
                <ToolInvocationList invocations={toolInvocations[msg.id]!} />
              </div>
            )}
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
