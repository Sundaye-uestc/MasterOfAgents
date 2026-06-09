import type { MessageRow } from "@agenthub/shared";
import { MarkdownContent } from "@agenthub/web/components/chat/MarkdownContent";
import { AgentBadge } from "@agenthub/web/components/chat/AgentBadge";

interface AgentInfo {
  agentId: string;
  agentName: string;
  adapterKind: string;
  avatar?: string | null;
}

interface Props {
  message: MessageRow;
  agentInfo?: AgentInfo;
  showSender: boolean;
  isStreaming?: boolean;
  userAvatar?: string | null;
}

export function MobileMessageBubble({ message, agentInfo, showSender, isStreaming: streamingProp, userAvatar }: Props) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const streaming = streamingProp || message.status === "streaming";

  // System messages: centered, muted
  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <div className="max-w-[85%] bg-gray-100 dark:bg-gray-800/60 rounded-xl px-4 py-2 text-xs text-gray-500 dark:text-gray-400 text-center">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-2 my-1 ${isUser ? "justify-end" : "justify-start"}`}>
      {/* Agent avatar (left side, before bubble) */}
      {!isUser && showSender && (
        <div className="flex-shrink-0 mt-1">
          {agentInfo ? (
            <AgentBadge
              agentName={agentInfo.agentName}
              adapterKind={agentInfo.adapterKind}
              avatar={agentInfo.avatar ?? undefined}
              size="sm"
              rounded="full"
            />
          ) : (
            <AgentBadge agentName="Agent" adapterKind="custom" size="sm" rounded="full" />
          )}
        </div>
      )}
      {!isUser && !showSender && <div className="w-7 flex-shrink-0" />}

      <div className={`max-w-[85%]`}>
        {/* Sender name */}
        {showSender && !isUser && agentInfo && (
          <div className="flex items-center gap-1.5 mb-0.5 ml-1">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              {agentInfo.agentName}
            </span>
          </div>
        )}

        {/* Bubble */}
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm ${
            isUser
              ? "bg-blue-600 text-white rounded-br-md"
              : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-bl-md"
          }`}
        >
          <MarkdownContent content={message.content || ""} />
          {streaming && (
            <span className="inline-block w-2 h-4 bg-current ml-0.5 animate-pulse align-middle" />
          )}
        </div>
      </div>

      {/* User avatar (right side, after bubble) */}
      {isUser && showSender && (
        <div className="flex-shrink-0 mt-1">
          {userAvatar ? (
            <img src={userAvatar} className="w-7 h-7 rounded-full object-cover border border-gray-300 dark:border-gray-600" alt="我" />
          ) : (
            <span className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-sm border border-gray-300 dark:border-gray-600">👤</span>
          )}
        </div>
      )}
    </div>
  );
}
