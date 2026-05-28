import { useState } from "react";
import type { MessageRow } from "@agenthub/shared";

interface Props {
  messages: MessageRow[];
  onScrollTo: (messageId: string) => void;
  onUnpin: (messageId: string) => void;
  onClose: () => void;
}

export function PinnedMessageBar({ messages, onScrollTo, onUnpin, onClose }: Props) {
  const [index, setIndex] = useState(0);

  if (messages.length === 0) return null;

  const current = messages[index % messages.length]!;
  const preview = (current.content ?? "").slice(0, 40) + ((current.content?.length ?? 0) > 40 ? "..." : "");

  return (
    <div className="border-b border-gray-700 bg-gray-800/80 px-4 py-1.5">
      <div className="max-w-4xl mx-auto flex items-center gap-2">
        <span className="text-xs text-yellow-500 flex-shrink-0">📌 已固定</span>
        <div className="flex-1 flex items-center gap-1 min-w-0">
          {messages.length > 1 && (
            <button
              onClick={() => setIndex((i) => (i - 1 + messages.length) % messages.length)}
              className="text-xs text-gray-500 hover:text-gray-300 flex-shrink-0"
            >
              ◀
            </button>
          )}
          <button
            onClick={() => onScrollTo(current.id)}
            className="text-xs text-gray-400 hover:text-gray-200 truncate text-left min-w-0"
            title="滚动到该消息"
          >
            <span className="text-gray-500">{current.role === "user" ? "你" : "Agent"}:</span> {preview}
          </button>
          {messages.length > 1 && (
            <button
              onClick={() => setIndex((i) => (i + 1) % messages.length)}
              className="text-xs text-gray-500 hover:text-gray-300 flex-shrink-0"
            >
              ▶
            </button>
          )}
          <span className="text-xs text-gray-600 flex-shrink-0">
            {index + 1}/{messages.length}
          </span>
        </div>
        <button
          onClick={() => onUnpin(current.id)}
          className="text-xs text-gray-500 hover:text-gray-300 flex-shrink-0 px-1"
        >
          取消固定
        </button>
        <button
          onClick={onClose}
          className="text-xs text-gray-600 hover:text-gray-400 flex-shrink-0"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
