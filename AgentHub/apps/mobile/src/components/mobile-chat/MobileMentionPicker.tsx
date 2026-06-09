import { AgentBadge } from "@agenthub/web/components/chat/AgentBadge";

interface MemberInfo {
  agentId: string;
  agentName: string;
  adapterKind: string;
  role?: string;
  avatar?: string | null;
}

interface Props {
  members: MemberInfo[];
  onSelect: (agentId: string, agentName: string) => void;
  onClose: () => void;
}

export function MobileMentionPicker({ members, onSelect, onClose }: Props) {
  return (
    <div className="absolute bottom-full left-0 right-0 z-20 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 rounded-t-xl shadow-lg max-h-48 overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-800">
        <span className="text-xs font-medium text-gray-500">提及 Agent</span>
        <button onClick={onClose} className="text-xs text-gray-400 w-6 h-6 flex items-center justify-center touch-target">✕</button>
      </div>
      {members.map((m) => (
        <button
          key={m.agentId}
          onClick={() => onSelect(m.agentId, m.agentName)}
          className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0 active:bg-gray-50 dark:active:bg-gray-800/50 touch-target"
        >
          <AgentBadge agentName={m.agentName} adapterKind={m.adapterKind} avatar={m.avatar ?? undefined} size="sm" rounded="full" />
          <div className="flex-1 text-left">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{m.agentName}</div>
            <div className="text-xs text-gray-500">{m.adapterKind}{m.role === "host" ? " · 👑" : ""}</div>
          </div>
        </button>
      ))}
    </div>
  );
}
