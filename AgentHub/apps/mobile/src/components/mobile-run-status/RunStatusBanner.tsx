import { useState } from "react";
import { TaskProgressList } from "./TaskProgressList.jsx";

interface Task {
  taskId: string;
  agentId: string;
  title: string;
  status: string;
}

interface Props {
  runStatus: string;
  tasks: Task[];
  progress: { completed: number; total: number };
  onStop: () => void;
}

export function RunStatusBanner({ runStatus, tasks, progress, onStop }: Props) {
  const [expanded, setExpanded] = useState(false);

  const statusLabel =
    runStatus === "completed"
      ? "已完成"
      : runStatus === "failed"
        ? "失败"
        : "运行中";

  const statusColor =
    runStatus === "completed"
      ? "text-green-600 dark:text-green-400"
      : runStatus === "failed"
        ? "text-red-600 dark:text-red-400"
        : "text-blue-600 dark:text-blue-400";

  return (
    <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2 text-xs touch-target"
      >
        <span className={`font-medium ${statusColor}`}>
          {statusLabel}
        </span>
        {progress.total > 0 && (
          <span className="text-gray-500">
            {progress.completed}/{progress.total}
          </span>
        )}
        <span className="flex-1" />
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStop();
          }}
          className="px-2 py-1 bg-red-500 text-white rounded text-xs font-medium active:bg-red-600 touch-target"
        >
          停止
        </button>
        <span className="text-gray-400 text-[10px]">{expanded ? "▲" : "▼"}</span>
      </button>

      {/* Progress bar */}
      {progress.total > 0 && (
        <div className="h-1 bg-gray-200 dark:bg-gray-700 mx-4 mb-1 rounded overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded transition-all"
            style={{ width: `${(progress.completed / progress.total) * 100}%` }}
          />
        </div>
      )}

      {expanded && tasks.length > 0 && <TaskProgressList tasks={tasks} />}
    </div>
  );
}
