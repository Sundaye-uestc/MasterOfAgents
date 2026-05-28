interface Props {
  content: string;
  role: string;
  onCancel: () => void;
}

export function ReplyPreviewCard({ content, role, onCancel }: Props) {
  const truncated = content.length > 60 ? content.slice(0, 60) + "..." : content;
  const roleLabel = role === "user" ? "你" : "Agent";

  return (
    <div className="border-t border-gray-800 bg-gray-900 px-4 py-2">
      <div className="max-w-4xl mx-auto flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className="text-xs text-gray-500 flex-shrink-0">回复 {roleLabel}:</span>
          <span className="text-xs text-gray-400 truncate border-l-2 border-blue-500 pl-2">
            {truncated}
          </span>
        </div>
        <button
          onClick={onCancel}
          className="text-xs text-gray-500 hover:text-gray-300 flex-shrink-0 px-2 py-0.5 hover:bg-gray-700 rounded"
        >
          取消
        </button>
      </div>
    </div>
  );
}
