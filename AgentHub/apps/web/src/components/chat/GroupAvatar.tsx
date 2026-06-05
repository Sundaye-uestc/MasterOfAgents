// ============================================================
// GroupAvatar — WeChat-style composite avatar grid for group chats
// Stitches member avatars + user avatar into a grid layout.
// ============================================================

import { logos } from "./AgentBadge.js";

interface MemberSlot {
  agentId?: string;
  agentName?: string;
  adapterKind?: string;
  /** true if this slot represents the human user */
  isUser?: boolean;
  userAvatar?: string | null;
  /** resolved logo URL for agents */
  logoSrc?: string;
}

const sizeConfig: Record<string, { container: string; cell: string; gap: string }> = {
  sm: { container: "w-7 h-7", cell: "w-[13px] h-[13px]", gap: "gap-px" },
  md: { container: "w-9 h-9", cell: "w-4 h-4", gap: "gap-px" },
  lg: { container: "w-14 h-14", cell: "w-[26px] h-[26px]", gap: "gap-[1px]" },
};

const bgColors: string[] = [
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-yellow-500",
  "bg-pink-500",
  "bg-teal-500",
  "bg-orange-500",
  "bg-indigo-500",
  "bg-red-500",
];

interface Props {
  members: Array<{ agentId: string; agentName: string; adapterKind: string }>;
  userAvatar?: string | null;
  size?: "sm" | "md" | "lg";
}

export function GroupAvatar({ members, userAvatar, size = "sm" }: Props) {
  const cfg = sizeConfig[size] ?? sizeConfig.sm!;

  // Build slots: user first, then agents (cap at 9 for 3x3)
  const slots: MemberSlot[] = [
    { isUser: true, userAvatar },
    ...members.map((m) => ({
      agentId: m.agentId,
      agentName: m.agentName,
      adapterKind: m.adapterKind,
      logoSrc: logos[m.adapterKind] ?? undefined,
    })),
  ].slice(0, 9);

  const total = slots.length;

  // Determine grid columns: 2 for 2-4 slots, 3 for 5+
  const cols = total <= 2 ? 2 : total <= 4 ? 2 : 3;

  return (
    <span
      className={`inline-grid ${cfg.gap} bg-gray-300 dark:bg-gray-600 rounded-md overflow-hidden flex-shrink-0 ${cfg.container}`}
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
    >
      {slots.map((slot, i) => (
        <span
          key={slot.isUser ? "user" : slot.agentId ?? i}
          className={`${cfg.cell} flex items-center justify-center ${
            slot.isUser
              ? userAvatar
                ? ""
                : "bg-gray-400 dark:bg-gray-500 text-gray-600 dark:text-gray-300"
              : (bgColors[i % bgColors.length])
          }`}
        >
          {slot.isUser ? (
            userAvatar ? (
              <img
                src={userAvatar}
                alt="我"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-[6px] leading-none">👤</span>
            )
          ) : slot.logoSrc ? (
            <img
              src={slot.logoSrc}
              alt={slot.agentName}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-white font-semibold leading-none text-[6px]">
              {slot.agentName?.slice(0, 2).toUpperCase()}
            </span>
          )}
        </span>
      ))}
    </span>
  );
}
