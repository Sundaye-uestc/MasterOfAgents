// ============================================================
// AgentBadge — avatar + name badge, color-coded by adapter kind
// ============================================================

interface AgentBadgeProps {
  agentName: string;
  adapterKind: string;
  avatar?: string;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  /** @default "md" — "md" for sidebar (square-ish), "full" for header (round) */
  rounded?: "md" | "full";
}

const sizeClasses: Record<string, string> = {
  sm: "w-7 h-7 text-[10px]",
  md: "w-7 h-7 text-xs",
  lg: "w-9 h-9 text-sm",
};

const adapterColors: Record<string, string> = {
  "claude-code": "border-blue-500 bg-blue-900/30 text-blue-300",
  codex: "border-green-500 bg-green-900/30 text-green-300",
  opencode: "border-purple-500 bg-purple-900/30 text-purple-300",
  custom: "border-yellow-500 bg-yellow-900/30 text-yellow-300",
};

export const logos: Record<string, string> = {
  "claude-code": "/agents/claude-code.png",
  codex: "/agents/codex.png",
  opencode: "/agents/opencode.png",
};

export function AgentBadge({ agentName, adapterKind, avatar, size = "sm", showName = false, rounded = "md" }: AgentBadgeProps) {
  const sz = sizeClasses[size] ?? sizeClasses.sm;
  const colors = adapterColors[adapterKind] ?? "border-gray-500 bg-gray-700 text-gray-300";
  const logoSrc = avatar ?? logos[adapterKind];
  const round = rounded === "full" ? "rounded-full" : "rounded-md";

  return (
    <span className="inline-flex items-center gap-1.5 flex-shrink-0">
      {logoSrc ? (
        <img
          src={logoSrc}
          alt={agentName}
          className={`${sz} ${round} object-cover border-2 ${colors.split(" ")[0]}`}
          title={agentName}
        />
      ) : (
        <span
          className={`inline-flex items-center justify-center ${round} border-2 font-bold ${sz} ${colors}`}
          title={agentName}
        >
          {agentName.slice(0, 2).toUpperCase()}
        </span>
      )}
      {showName && (
        <span className="text-sm text-gray-200">{agentName}</span>
      )}
    </span>
  );
}
