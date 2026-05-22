import { useState, useRef, useCallback, useEffect, type KeyboardEvent } from "react";

interface MemberInfo {
  agentId: string;
  agentName: string;
  role: string;
  adapterKind: string;
}

interface Props {
  onSend: (content: string, replyToId?: string, mentionedAgentIds?: string[]) => void;
  disabled?: boolean;
  onStop?: () => void;
  members?: MemberInfo[];
}

export function MessageInput({ onSend, disabled, onStop, members }: Props) {
  const [text, setText] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [mentionIdx, setMentionIdx] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Extract mentioned agent IDs from text
  const getMentionedIds = useCallback(
    (content: string): string[] => {
      if (!members || members.length === 0) return [];
      const ids: string[] = [];
      const regex = /@(\S+)/g;
      let m: RegExpExecArray | null;
      while ((m = regex.exec(content)) !== null) {
        const raw = m[1];
        if (!raw) continue;
        const name = raw.replace(/[.,;:!?]$/, "");
        const member = members.find((mb) => mb.agentName === name);
        if (member && !ids.includes(member.agentId)) {
          ids.push(member.agentId);
        }
      }
      return ids;
    },
    [members]
  );

  const handleSend = useCallback(() => {
    const content = text.trim();
    if (!content || disabled) return;
    const mentionedIds = getMentionedIds(content);
    onSend(content, undefined, mentionedIds.length > 0 ? mentionedIds : undefined);
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [text, disabled, onSend, getMentionedIds]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentions) {
      const filtered = getFilteredMembers();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIdx((i) => (i + 1) % filtered.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIdx((i) => (i - 1 + filtered.length) % filtered.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (filtered[mentionIdx]) {
          insertMention(filtered[mentionIdx].agentName);
        }
        return;
      }
      if (e.key === "Escape") {
        setShowMentions(false);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!showMentions) handleSend();
    }
  };

  const getFilteredMembers = useCallback(() => {
    if (!members) return [];
    const f = mentionFilter.toLowerCase();
    return members.filter(
      (m) => m.agentName.toLowerCase().includes(f)
    );
  }, [members, mentionFilter]);

  const insertMention = (name: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const before = text.slice(0, el.selectionStart);
    const after = text.slice(el.selectionStart);
    const atIdx = before.lastIndexOf("@");
    if (atIdx === -1) return;
    const newBefore = before.slice(0, atIdx) + `@${name} `;
    const newText = newBefore + after;
    setText(newText);
    setShowMentions(false);
    setTimeout(() => {
      el.focus();
      const pos = newBefore.length;
      el.setSelectionRange(pos, pos);
    }, 0);
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
    }
  };

  const handleChange = (val: string) => {
    setText(val);
    handleInput();

    // Check for @mention trigger
    if (members && members.length > 0) {
      const el = textareaRef.current;
      if (el) {
        const cursor = el.selectionStart;
        const beforeCursor = val.slice(0, cursor);
        const atMatch = beforeCursor.match(/@([^\s@]*)$/);
        if (atMatch) {
          setMentionFilter(atMatch[1] ?? "");
          setMentionIdx(0);
          setShowMentions(true);
          return;
        }
      }
    }
    setShowMentions(false);
  };

  const filteredMembers = getFilteredMembers();

  return (
    <div className="border-t border-gray-800 p-4 bg-gray-900">
      {/* Members bar for group chat */}
      {members && members.length > 1 && (
        <div className="flex items-center gap-2 mb-2 max-w-4xl mx-auto">
          <span className="text-xs text-gray-500">
            {members.length} 个 Agent 参与
          </span>
          <div className="flex gap-1">
            {members.slice(0, 5).map((m) => (
              <span key={m.agentId} className="text-xs bg-gray-800 px-1.5 py-0.5 rounded text-gray-400">
                @{m.agentName}
              </span>
            ))}
            {members.length > 5 && (
              <span className="text-xs text-gray-600">+{members.length - 5}</span>
            )}
          </div>
        </div>
      )}

      <div className="flex items-end gap-3 max-w-4xl mx-auto relative">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={members && members.length > 1 ? "输入消息，使用 @ 提及 Agent..." : "输入消息..."}
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
        />

        {/* @mention popover */}
        {showMentions && filteredMembers.length > 0 && (
          <div className="absolute bottom-full left-0 mb-1 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-20 max-h-40 overflow-y-auto">
            {filteredMembers.map((m, i) => (
              <button
                key={m.agentId}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(m.agentName);
                }}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${
                  i === mentionIdx ? "bg-gray-700 text-white" : "text-gray-300 hover:bg-gray-700"
                }`}
              >
                <span className="text-xs text-gray-500">@</span>
                {m.agentName}
              </button>
            ))}
          </div>
        )}

        {disabled && onStop ? (
          <button
            onClick={onStop}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
          >
            🛑停止输出
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={disabled || !text.trim()}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
          >
            发送
          </button>
        )}
      </div>
    </div>
  );
}
