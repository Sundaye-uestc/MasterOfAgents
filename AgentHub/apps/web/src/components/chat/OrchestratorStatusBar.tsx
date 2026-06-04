// ============================================================
// OrchestratorStatusBar — orchestrated run progress bar
// ============================================================

import { TaskProgressCard } from "./TaskProgressCard.js";

interface TaskInfo {
  id: string;
  title: string;
  description?: string;
  agentId?: string;
  agentName?: string;
  adapterKind?: string;
  status: string;
  dependencies?: string[];
}

interface OrchestratorStatusBarProps {
  runId: string;
  status: string;
  tasks: TaskInfo[];
  progress: { completed: number; total: number };
  expanded?: boolean;
  onToggle?: () => void;
}

const statusLabel: Record<string, string> = {
  queued: "排队中",
  running: "运行中",
  completed: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

const statusColor: Record<string, string> = {
  queued: "text-gray-400",
  running: "text-blue-400",
  completed: "text-green-400",
  failed: "text-red-400",
  cancelled: "text-yellow-400",
};

export function OrchestratorStatusBar({ runId, status, tasks, progress, expanded, onToggle }: OrchestratorStatusBarProps) {
  const pct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

  return (
    <div className="rounded-2xl border border-blue-200 dark:border-blue-800/40 bg-blue-50/50 dark:bg-blue-900/10 overflow-hidden">
      {/* Summary row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-100/50 dark:hover:bg-blue-900/20 transition-colors text-left"
      >
        <span className="relative flex h-2 w-2 flex-shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
        </span>
        <span className={`text-xs font-medium ${statusColor[status] ?? "text-gray-400"}`}>
          {statusLabel[status] ?? status}
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500">任务规划中…</span>
        <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs text-gray-500">
          {progress.completed}/{progress.total}
        </span>
        <span className="text-gray-500 text-[10px]">{expanded ? "▲" : "▼"}</span>
      </button>

      {/* Expanded task list */}
      {expanded && tasks.length > 0 && (
        <div className="px-4 pb-3 space-y-1.5 max-h-48 overflow-y-auto">
          {tasks.map((task) => (
            <TaskProgressCard
              key={task.id}
              task={task}
              isActive={task.status === "running"}
            />
          ))}
        </div>
      )}
    </div>
  );
}
