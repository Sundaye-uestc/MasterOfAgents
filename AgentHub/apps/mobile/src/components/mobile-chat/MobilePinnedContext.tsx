import type { MessageRow } from "@agenthub/shared";

interface Props {
  messages: MessageRow[];
  onDismiss: () => void;
}

export function MobilePinnedContext({ messages, onDismiss }: Props) {
  if (messages.length === 0) return null;

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800 px-4 py-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
          📌 {messages.length} 条置顶消息
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-yellow-700 dark:text-yellow-300 truncate">
            {messages[0]?.content?.slice(0, 50) || ""}
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="text-yellow-500 text-xs w-6 h-6 flex items-center justify-center touch-target"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
