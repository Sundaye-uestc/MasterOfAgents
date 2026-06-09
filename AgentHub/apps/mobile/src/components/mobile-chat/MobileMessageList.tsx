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
            {/* Inline artifact preview cards — below agent messages that produced artifacts */}
            {msg.role === "agent" && msg.runId && runArtifacts?.[msg.runId] && runArtifacts[msg.runId]!.length > 0 && (
              <div className="ml-10 max-w-[85%] space-y-1">
                {runArtifacts[msg.runId]!.map((art) => (
                  <MobileInlineArtifactCard key={art.id} artifact={art} />
                ))}
              </div>
            )}
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
