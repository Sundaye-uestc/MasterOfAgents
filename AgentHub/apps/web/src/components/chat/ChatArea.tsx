import { useEffect, useState, useRef, useCallback } from "react";
import type { MessageRow } from "@agenthub/shared";
import { listMessages, sendMessage } from "../../lib/api.js";
import { useWebSocket } from "../../hooks/useWebSocket.js";
import type { WsServerEvent } from "../../hooks/useWebSocket.js";
import { MessageInput } from "./MessageInput.js";

interface Props {
  conversationId: string;
  onRefreshList: () => void;
  agentId?: string;
}

export function ChatArea({ conversationId, onRefreshList, agentId }: Props) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load messages on mount / conversation change
  useEffect(() => {
    setLoading(true);
    setMessages([]);
    setStreamingMsgId(null);
    listMessages(conversationId)
      .then((msgs) => {
        setMessages(msgs);
        setLoading(false);
        setTimeout(scrollToBottom, 100);
      })
      .catch(() => setLoading(false));
  }, [conversationId]);

  // WebSocket for real-time events
  const onWsEvent = useCallback(
    (event: WsServerEvent) => {
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
              m.id === event.messageId ? { ...m, status: "sent" as const } : m
            )
          );
          setRunning(false);
          onRefreshList();
          break;
        case "run:started":
          setRunning(true);
          break;
        case "run:completed":
          setRunning(false);
          setStreamingMsgId(null);
          break;
        case "run:failed":
          setRunning(false);
          setStreamingMsgId(null);
          break;
      }
    },
    [onRefreshList]
  );

  useWebSocket(conversationId, onWsEvent);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSend = useCallback(
    async (content: string, replyToId?: string) => {
      try {
        const result = await sendMessage(conversationId, content, replyToId, agentId);
        const agentPlaceholder: MessageRow = {
          id: result.agentMessageId,
          conversationId,
          role: "agent",
          content: "",
          status: "streaming",
          runId: null,
          taskId: null,
          agentId: null,
          replyToId: null,
          segmentsJson: null,
          metadataJson: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, result.userMessage, agentPlaceholder]);
        setRunning(true);
        setTimeout(scrollToBottom, 100);
      } catch (err) {
        console.error("Failed to send message", err);
      }
    },
    [conversationId, agentId]
  );

  return (
    <>
      {/* Header */}
      <div className="border-b border-gray-800 p-4 bg-gray-900 flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-300">
          <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2" />
          Conversation
        </h2>
        {running && (
          <span className="text-xs text-green-400">Agent is responding...</span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {loading && (
          <p className="text-center text-gray-600 text-sm">Loading...</p>
        )}
        {!loading && messages.length === 0 && (
          <p className="text-center text-gray-600 text-sm mt-12">
            Send a message to start the conversation
          </p>
        )}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isStreaming={msg.id === streamingMsgId}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      <MessageInput onSend={handleSend} disabled={running} />
    </>
  );
}

// --- Message Bubble ---

function MessageBubble({
  message,
  isStreaming,
}: {
  message: MessageRow;
  isStreaming: boolean;
}) {
  const isUser = message.role === "user";
  const isAgent = message.role === "agent";

  return (
    <div className={`flex mb-4 ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-lg px-4 py-2.5 text-sm ${
          isUser
            ? "bg-blue-600 text-white"
            : isAgent
            ? "bg-gray-800 text-gray-100 border border-gray-700"
            : "bg-gray-800/50 text-gray-400 italic"
        }`}
      >
        {/* Reply indicator */}
        {message.replyToId && (
          <div className="text-xs text-gray-500 mb-1 border-l-2 border-gray-600 pl-2">
            Replying to a message
          </div>
        )}

        {/* Content */}
        <div className="whitespace-pre-wrap break-words">
          {message.content || (isStreaming ? "..." : "")}
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 mt-1">
          {message.status === "streaming" && (
            <span className="text-xs text-green-400">思考中🤔<AnimatedDots /></span>
          )}
          {message.status === "sent" && isAgent && message.content && (
            <span className="text-xs text-gray-500">回答完毕✅️</span>
          )}
          {message.status === "error" && (
            <span className="text-xs text-red-400">Error</span>
          )}
          <span className="text-xs text-gray-600 ml-auto">
            {new Date(message.createdAt).toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  );
}

function AnimatedDots() {
  const [dots, setDots] = useState(1);

  useEffect(() => {
    const id = setInterval(() => {
      setDots((n) => (n % 5) + 1);
    }, 500);
    return () => clearInterval(id);
  }, []);

  return <span>{".".repeat(dots)}</span>;
}
