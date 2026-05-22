// ============================================================
// TaskProgressCard — compact task status card
// ============================================================

import { AgentBadge } from "./AgentBadge.js";

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

const statusConfig: Record<string, { icon: string; color: string; label: string }> = {
  queued: { icon: "○", color: "text-gray-500", label: "排队中" },
  running: { icon: "◉", color: "text-blue-400", label: "运行中" },
  completed: { icon: "●", color: "text-green-400", label: "已完成" },
  failed: { icon: "●", color: "text-red-400", label: "失败" },
  blocked: { icon: "◇", color: "text-yellow-400", label: "已阻塞" },
  skipped: { icon: "○", color: "text-gray-600", label: "已跳过" },
};

interface TaskProgressCardProps {
  task: TaskInfo;
  isActive: boolean;
}

export function TaskProgressCard({ task, isActive }: TaskProgressCardProps) {
  const cfg = statusConfig[task.status] ?? { icon: "○", color: "text-gray-500", label: "排队中" };
  const pendingDeps = task.dependencies?.length ?? 0;

  return (
    <div
      className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
        isActive
          ? "border-blue-500 bg-blue-900/10"
          : "border-gray-700 bg-gray-800/50"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`${cfg.color} ${task.status === "running" ? "animate-pulse" : ""}`}>
          {cfg.icon}
        </span>
        <span className="text-gray-200 font-medium truncate flex-1">{task.title}</span>
        {task.agentName && task.adapterKind && (
          <AgentBadge agentName={task.agentName} adapterKind={task.adapterKind} size="sm" />
        )}
      </div>
      {task.description && (
        <p className="text-xs text-gray-500 mt-1 truncate">{task.description}</p>
      )}
      <div className="flex items-center gap-2 mt-1">
        <span className={`text-xs ${cfg.color}`}>{cfg.label}</span>
        {pendingDeps > 0 && task.status === "queued" && (
          <span className="text-xs text-gray-600">等待 {pendingDeps} 个前置任务</span>
        )}
      </div>
    </div>
  );
}
