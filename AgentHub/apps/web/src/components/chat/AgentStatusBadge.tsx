// ============================================================
// AgentStatusBadge — avatar + online status indicator
// ============================================================

import { AgentBadge } from "./AgentBadge.js";

const statusColors: Record<string, string> = {
  online: "bg-green-500",
  offline: "bg-gray-500",
  busy: "bg-yellow-500",
  error: "bg-red-500",
};

interface AgentStatusBadgeProps {
  agentName: string;
  agentId: string;
  status: string;
  adapterKind: string;
  size?: "sm" | "md";
}

export function AgentStatusBadge({ agentName, status, adapterKind, size = "sm" }: AgentStatusBadgeProps) {
  const dot = statusColors[status] ?? statusColors.offline;

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative">
        <AgentBadge agentName={agentName} adapterKind={adapterKind} size={size} />
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-gray-800 ${dot}`}
          title={status}
        />
      </span>
    </span>
  );
}
