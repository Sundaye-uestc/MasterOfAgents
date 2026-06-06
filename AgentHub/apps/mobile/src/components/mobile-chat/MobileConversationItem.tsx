import { useState, useRef, useEffect, useCallback } from "react";
import type { ConversationRow } from "@agenthub/shared";
import { AgentBadge } from "@agenthub/web/components/chat/AgentBadge";
import { GroupAvatar } from "@agenthub/web/components/chat/GroupAvatar";

interface AgentInfo {
  agentId: string;
  agentName: string;
  adapterKind: string;
}

interface Props {
  conversation: ConversationRow;
  agentInfo?: AgentInfo;
  members?: Array<{ agentId: string; agentName: string; adapterKind: string }>;
  userAvatar?: string | null;
  isSelected: boolean;
  editingId: string | null;
  editTitle: string;
  onEditTitle: (val: string) => void;
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  onArchive: (id: string, archived: boolean) => void;
  onManageMembers?: (id: string) => void;
}

export function MobileConversationItem({
  conversation,
  agentInfo,
  members,
  userAvatar,
  isSelected,
  editingId,
  editTitle,
  onEditTitle,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onSelect,
  onDelete,
  onPin,
  onArchive,
  onManageMembers,
}: Props) {
  const isEditing = editingId === conversation.id;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const isArchived = conversation.status === "archived";
  const isGroup = conversation.type === "group";

  return (
    <div
      className={`flex items-center border-b border-gray-200 dark:border-gray-800/30 px-2 ${
        isSelected ? "bg-blue-500/10 rounded-lg" : ""
      }`}
    >
      <button
        onClick={() => !isEditing && onSelect(conversation.id)}
        className="flex items-center gap-2 flex-1 text-left px-2 py-2.5 active:bg-gray-100 dark:active:bg-gray-800/30 rounded-lg transition-colors min-w-0 touch-target"
      >
        {/* Avatar — matches web exactly */}
        {isGroup ? (
          <GroupAvatar members={members ?? []} userAvatar={userAvatar} size="sm" />
        ) : agentInfo ? (
          <AgentBadge agentName={agentInfo.agentName} adapterKind={agentInfo.adapterKind} size="sm" />
        ) : null}

        <div className="min-w-0 flex-1">
          {isEditing ? (
            <input
              value={editTitle}
              onChange={(e) => onEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSaveEdit(conversation.id);
                if (e.key === "Escape") onCancelEdit();
              }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-100 dark:bg-gray-700 text-sm text-gray-900 dark:text-white px-1 py-0.5 rounded border border-blue-500 focus:outline-none w-full"
            />
          ) : (
            <span className="text-sm text-gray-700 dark:text-gray-200 truncate block">
              {conversation.pinnedAt && <span className="mr-1">📌</span>}
              {conversation.title}
            </span>
          )}
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {isGroup ? "群聊" : "单聊"}
            </span>
            {isArchived && (
              <span className="text-xs text-yellow-600">已归档</span>
            )}
          </div>
        </div>
      </button>

      {/* ··· Dropdown menu — matches web exactly */}
      <div className="relative" ref={menuOpen ? menuRef : undefined}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
          className="px-2 py-1 mr-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-gray-700/50 rounded-lg touch-target"
        >
          ···
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-gray-800/95 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 rounded-xl shadow-xl z-10 overflow-hidden">
            <button
              onClick={() => { onPin(conversation.id, !conversation.pinnedAt); setMenuOpen(false); }}
              className="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700/50 touch-target"
            >
              {conversation.pinnedAt ? "📌 取消置顶" : "📌 置顶"}
            </button>
            <button
              onClick={() => { onStartEdit(conversation.id); setMenuOpen(false); }}
              className="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700/50 touch-target"
            >
              ✍️ 重命名
            </button>
            {isGroup && onManageMembers && (
              <>
                <div className="border-t border-gray-200 dark:border-gray-700/50" />
                <button
                  onClick={() => { onManageMembers?.(conversation.id); setMenuOpen(false); }}
                  className="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700/50 touch-target"
                >
                  👥 管理成员
                </button>
              </>
            )}
            <div className="border-t border-gray-200 dark:border-gray-700/50" />
            {isArchived ? (
              <button
                onClick={() => { onArchive(conversation.id, false); setMenuOpen(false); }}
                className="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700/50 touch-target"
              >
                📂 取消归档
              </button>
            ) : (
              <button
                onClick={() => { onArchive(conversation.id, true); setMenuOpen(false); }}
                className="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700/50 touch-target"
              >
                📦 归档
              </button>
            )}
            <div className="border-t border-gray-200 dark:border-gray-700/50" />
            <button
              onClick={() => { onDelete(conversation.id); setMenuOpen(false); }}
              className="w-full text-left px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 touch-target"
            >
              🗑️ 删除
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
