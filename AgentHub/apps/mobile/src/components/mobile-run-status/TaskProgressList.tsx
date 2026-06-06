interface Task {
  taskId: string;
  agentId: string;
  title: string;
  status: string;
}

interface Props {
  tasks: Task[];
}

const statusIcon: Record<string, string> = {
  queued: "⏳",
  running: "🔄",
  completed: "✅",
  failed: "❌",
};

const statusLabel: Record<string, string> = {
  queued: "排队中",
  running: "执行中",
  completed: "已完成",
  failed: "失败",
};

export function TaskProgressList({ tasks }: Props) {
  return (
    <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 space-y-1">
      {tasks.map((t) => (
        <div key={t.taskId} className="flex items-center gap-2 text-xs">
          <span>{statusIcon[t.status] || "⏳"}</span>
          <span className="flex-1 text-gray-700 dark:text-gray-300 truncate">{t.title}</span>
          <span className="text-gray-400 flex-shrink-0">{statusLabel[t.status] || t.status}</span>
        </div>
      ))}
    </div>
  );
}
