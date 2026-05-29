import { useState, useRef, useEffect } from "react";
import type { MessageRow } from "@agenthub/shared";
import { MarkdownContent } from "./MarkdownContent.js";

interface Props {
  message: MessageRow;
  isStreaming: boolean;
  onDelete: (msgId: string) => void;
  agentColor?: string;
  onReply?: (msgId: string, content: string, role: string) => void;
  onPin?: (msgId: string, pinned: boolean) => void;
  onRegenerate?: (msgId: string) => void;
}

export function isMessagePinned(msg: MessageRow): boolean {
  if (!msg.metadataJson) return false;
  try {
    return JSON.parse(msg.metadataJson).pinned === true;
  } catch {
    return false;
  }
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

export function MessageBubble({
  message,
  isStreaming,
  onDelete,
  agentColor,
  onReply,
  onPin,
  onRegenerate,
}: Props) {
  const isUser = message.role === "user";
  const isAgent = message.role === "agent";
  const isSystem = message.role === "system";
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener("mousedown", handler);
    }
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const handleCopy = () => {
    setMenuOpen(false);
    navigator.clipboard.writeText(message.content ?? "").catch(() => {});
  };

  const handleDelete = () => {
    setMenuOpen(false);
    onDelete(message.id);
  };

  const borderClass = agentColor ? `border-l-2 ${agentColor}` : "";

  return (
    <div
      className={`rounded-lg relative group ${borderClass} ${
        isSystem
          ? "px-3 py-1 text-xs bg-gray-800/50 text-gray-400 border border-gray-700/50"
          : `px-4 py-2.5 text-sm ${
              isUser
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-100 border border-gray-700"
            }`
      }`}
    >
      {/* System message: timestamp centered at top */}
      {isSystem && (
        <div className="text-center text-xs text-gray-500 mb-1">
          {new Date(message.createdAt).toLocaleTimeString()}
        </div>
      )}

      {/* Dropdown menu trigger */}
      {message.content && (message.status as string) !== "streaming" && (
        <div className={`absolute bottom-1 ${isUser ? "left-1" : "right-1"}`} ref={menuOpen ? menuRef : null}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            className="text-gray-500 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity px-1 rounded hover:bg-gray-700 text-xs"
          >
            ···
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-28 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-10">
              <button
                onClick={handleCopy}
                className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 rounded-t-md"
              >
                📋复制
              </button>
              {onReply && (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onReply(message.id, message.content ?? "", message.role);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700"
                >
                  💬 回复
                </button>
              )}
              {onPin && message.content && (message.status as string) !== "streaming" && (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onPin(message.id, !isMessagePinned(message));
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700"
                >
                  {isMessagePinned(message) ? "📌 取消固定" : "📌 固定"}
                </button>
              )}
              {isAgent && onRegenerate && (message.status as string) !== "streaming" && (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onRegenerate(message.id);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700"
                >
                  🔄 重新生成
                </button>
              )}
              <button
                onClick={handleDelete}
                className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-700 rounded-b-md"
              >
                🗑️删除
              </button>
            </div>
          )}
        </div>
      )}

      {/* Reply indicator */}
      {message.replyToId && (
        <div className="text-xs text-gray-500 mb-1 border-l-2 border-gray-600 pl-2">
          回复消息
        </div>
      )}

      {/* Pin indicator */}
      {isMessagePinned(message) && (
        <div className="text-xs text-yellow-500 mb-1">
          📌 已固定
        </div>
      )}

      {/* Content */}
      {isAgent && message.content ? (
        <MarkdownContent content={message.content} />
      ) : (
        <div className="whitespace-pre-wrap break-words">
          {message.content || (isStreaming ? "..." : "")}
        </div>
      )}

      {/* Status */}
      <div className="flex items-center gap-2 mt-1">
        {message.status === "streaming" && (
          <span className="text-xs text-green-400">思考中🤔<AnimatedDots /></span>
        )}
        {message.status === "sent" && isAgent && message.content && (
          <span className="text-xs text-gray-500">回答完毕✅️</span>
        )}
        {message.status === "error" && (
          <span className="text-xs text-red-400">❌️对话被打断</span>
        )}
        {!isSystem && (
          <span className={`text-xs ${isUser ? "text-blue-200" : "text-gray-600"} ${isAgent ? "ml-auto" : ""}`}>
            {new Date(message.createdAt).toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  );
}