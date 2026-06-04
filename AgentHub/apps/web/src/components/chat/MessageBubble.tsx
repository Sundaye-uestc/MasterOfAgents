import { useState, useRef, useEffect } from "react";
import type { MessageRow } from "@agenthub/shared";
import { MarkdownContent } from "./MarkdownContent.js";

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function CopyIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function RegenerateIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function ThumbsUpIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
    </svg>
  );
}

function ThumbsDownIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10zm7 0h3a2 2 0 002-2v-7a2 2 0 00-2-2h-3" />
    </svg>
  );
}

function EllipsisIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Thinking indicator — top of agent response
// ---------------------------------------------------------------------------

function ThinkingHeader({ status, thinkingMs }: { status: string; thinkingMs: number | null }) {
  if (status === "streaming") {
    return (
      <div className="flex items-center gap-2 mb-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">思考中…</span>
      </div>
    );
  }
  if (status === "sent" && thinkingMs !== null) {
    const seconds = Math.max(1, Math.round(thinkingMs / 1000));
    return (
      <div className="text-xs text-gray-400 dark:text-gray-500 mb-2">
        已思考 {seconds}s
      </div>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// MessageBubble
// ---------------------------------------------------------------------------

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
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  // Track thinking duration
  const startRef = useRef<number>(Date.now());
  const [thinkingMs, setThinkingMs] = useState<number | null>(null);

  useEffect(() => {
    if (isStreaming && !message.content) {
      startRef.current = Date.now();
    }
    if (!isStreaming && message.content && thinkingMs === null) {
      setThinkingMs(Date.now() - startRef.current);
    }
  }, [isStreaming, message.content, thinkingMs]);

  // Outside click for menu
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
    navigator.clipboard.writeText(message.content ?? "").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };

  const handleDelete = () => {
    setMenuOpen(false);
    onDelete(message.id);
  };

  const borderClass = agentColor ? `border-l-2 ${agentColor}` : "";
  const showActions = message.content && (message.status as string) !== "streaming";

  const bubbleContent = (
    <div
      className={`rounded-2xl relative ${borderClass} ${
        isSystem
          ? "px-3 py-1 text-xs bg-gray-100 dark:bg-gray-800/30 text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700/30"
          : `px-4 py-3 text-sm ${
              isUser
                ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700"
                : "bg-gray-100 dark:bg-gray-800/60 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700/50"
            }`
      }`}
    >
      {/* System message */}
      {isSystem && (
        <div className="text-center text-xs text-gray-400 dark:text-gray-500 mb-1">
          {new Date(message.createdAt).toLocaleTimeString()}
        </div>
      )}

      {/* Thinking header — top of agent response */}
      {isAgent && (
        <ThinkingHeader
          status={isStreaming ? "streaming" : (message.status as string)}
          thinkingMs={thinkingMs}
        />
      )}

      {/* Reply indicator */}
      {message.replyToId && (
        <div className="text-xs text-gray-400 dark:text-gray-500 mb-1 border-l-2 border-gray-300 dark:border-gray-600 pl-2">
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
          {message.content || (isStreaming ? "" : "")}
        </div>
      )}

      {/* Agent action bar — inside bubble */}
      {showActions && isAgent && (
        <div className="flex items-center gap-0.5 mt-2 pt-1.5 border-t border-gray-200 dark:border-white/5">
          {/* Copy */}
          <button
            onClick={handleCopy}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors ${
              copied
                ? "text-green-400 bg-green-900/20"
                : "text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-gray-700/50"
            }`}
            title={copied ? "已复制" : "复制"}
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
          </button>

          {/* Regenerate */}
          {onRegenerate && (
            <button
              onClick={() => onRegenerate(message.id)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-gray-700/50 transition-colors"
              title="重新生成"
            >
              <RegenerateIcon />
            </button>
          )}

          {/* Thumbs up */}
          <button
            onClick={() => setFeedback(feedback === "up" ? null : "up")}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors ${
              feedback === "up"
                ? "text-green-400 bg-green-900/20"
                : "text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-gray-700/50"
            }`}
            title="赞同"
          >
            <ThumbsUpIcon />
          </button>
          {/* Thumbs down */}
          <button
            onClick={() => setFeedback(feedback === "down" ? null : "down")}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors ${
              feedback === "down"
                ? "text-red-400 bg-red-900/20"
                : "text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-gray-700/50"
            }`}
            title="不赞同"
          >
            <ThumbsDownIcon />
          </button>

          {/* Ellipsis menu */}
          <div className="relative ml-auto" ref={menuOpen ? menuRef : null}>
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-gray-700/50 transition-colors"
            >
              <EllipsisIcon />
            </button>
            {menuOpen && (
              <div className="absolute right-0 bottom-full mb-1 w-32 bg-white dark:bg-gray-800/95 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 rounded-xl shadow-xl z-10 overflow-hidden">
                {onReply && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onReply(message.id, message.content ?? "", message.role);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700/50"
                  >
                    💬 回复
                  </button>
                )}
                {onPin && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onPin(message.id, !isMessagePinned(message));
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700/50"
                  >
                    {isMessagePinned(message) ? "📌 取消固定" : "📌 固定"}
                  </button>
                )}
                <button
                  onClick={handleDelete}
                  className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700/50"
                >
                  🗑️ 删除
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error status */}
      {message.status === "error" && (
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-red-400">❌ 对话被打断</span>
        </div>
      )}
    </div>
  );

  // User messages: action bar outside the bubble, hover to reveal
  const userActions = showActions && isUser && (
    <div className="flex items-center gap-0.5 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        onClick={handleCopy}
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors ${
          copied ? "text-green-400 bg-green-900/20" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
        }`}
        title={copied ? "已复制" : "复制"}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
    </div>
  );

  if (isUser) {
    return (
      <div className="group">
        {bubbleContent}
        {userActions}
      </div>
    );
  }

  return bubbleContent;
}
