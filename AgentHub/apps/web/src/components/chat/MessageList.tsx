import type { MessageRow } from "@agenthub/shared";
import { MessageBubble } from "./MessageBubble.js";
import { ToolInvocationCard } from "./ToolInvocationCard.js";
import { AgentBadge } from "./AgentBadge.js";

interface Props {
  messages: MessageRow[];
  streamingMsgId: string | null;
  toolInvocations: Record<string, Array<{
    id: string;
    toolName: string;
    inputJson?: string;
    outputJson?: string;
    status: string;
  }>>;
  members: Array<{ agentId: string; agentName: string; role: string; adapterKind: string }>;
  conversationType?: "direct" | "group";
  conversationTitle?: string;
  adapterKind?: string;
  userAvatar?: string | null;
  onDeleteMessage: (msgId: string) => void;
  onReply?: (msgId: string, content: string, role: string) => void;
  onPin?: (msgId: string, pinned: boolean) => void;
  onRegenerate?: (msgId: string) => void;
}

export function MessageList({
  messages,
  streamingMsgId,
  toolInvocations,
  members,
  conversationType,
  conversationTitle,
  adapterKind,
  userAvatar,
  onDeleteMessage,
  onReply,
  onPin,
  onRegenerate,
}: Props) {
  if (messages.length === 0) {
    return (
      <p className="text-center text-gray-600 text-sm mt-12">
        发送消息开始对话
      </p>
    );
  }

  const getMemberInfo = (msgAgentId?: string | null) => {
    if (!msgAgentId || members.length === 0) return null;
    return members.find((m) => m.agentId === msgAgentId);
  };

  const agentColor = (kind: string) => {
    const colors: Record<string, string> = {
      "claude-code": "border-l-blue-500",
      codex: "border-l-green-500",
      opencode: "border-l-purple-500",
      custom: "border-l-yellow-500",
    };
    return colors[kind] ?? "border-l-gray-500";
  };

  return (
    <>
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
                onDelete={onDeleteMessage}
                onReply={onReply}
                onPin={onPin}
                onRegenerate={onRegenerate}
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
            {isAgent && (
              <AgentBadge
                agentName={agentName}
                adapterKind={agentAdapterKind}
                size="lg"
              />
            )}

            <div className="max-w-[75%]">
              {isAgent && showAgentName && (
                <div className="text-xs text-gray-500 mb-1">{agentName}</div>
              )}
              <MessageBubble
                message={msg}
                isStreaming={msg.id === streamingMsgId}
                onDelete={onDeleteMessage}
                agentColor={isAgent ? agentColor(agentAdapterKind) : undefined}
                onReply={onReply}
                onPin={onPin}
                onRegenerate={onRegenerate}
              />
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
            </div>

            {isUser && (
              userAvatar ? (
                <img
                  src={userAvatar}
                  className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                  alt="用户头像"
                />
              ) : (
                <span className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center text-base flex-shrink-0 border border-gray-600">
                  👤
                </span>
              )
            )}
          </div>
        );
      })}
    </>
  );
}