import { formatCapability } from "@agenthub/web/components/chat/CapabilityTags";
import { AgentBadge } from "@agenthub/web/components/chat/AgentBadge";

interface MemberInfo {
  agentId: string;
  agentName: string;
  adapterKind: string;
  role?: string;
}

interface Props {
  members: MemberInfo[];
  capabilities: Record<string, string[]>;
  conversationType: "direct" | "group";
  onClose: () => void;
}

export function MobileMemberSheet({ members, capabilities, conversationType, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Sheet */}
      <div
        className="relative bg-white dark:bg-gray-900 rounded-t-2xl max-h-[60vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {conversationType === "group" ? `Agent · ${members.length}` : "对话信息"}
          </span>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 touch-target"
          >
            ✕
          </button>
        </div>

        {/* Member list */}
        <div className="overflow-y-auto">
          {members.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">暂无成员信息</p>
          ) : (
            members.map((m) => {
              const caps = capabilities[m.agentId] ?? [];
              return (
                <div
                  key={m.agentId}
                  className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 dark:border-gray-800/50"
                >
                  <AgentBadge
                    agentName={m.agentName}
                    adapterKind={m.adapterKind}
                    size="sm"
                    rounded="full"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                      {m.agentName}
                      {m.role === "host" && (
                        <span className="ml-1 text-xs" title="主持人">👑</span>
                      )}
                    </div>
                    {caps.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {caps.map((cap) => (
                          <span
                            key={cap}
                            className="inline-block px-1.5 py-0.5 text-[10px] rounded bg-gray-100 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400"
                          >
                            {formatCapability(cap)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Safe area padding for bottom */}
        <div className="h-6 pb-safe flex-shrink-0" />
      </div>
    </div>
  );
}
