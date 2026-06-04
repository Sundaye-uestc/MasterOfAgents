import { useState, useRef, useCallback, type KeyboardEvent, type ChangeEvent } from "react";

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
  replyToId?: string;
  onCancelReply?: () => void;
}

export function MessageInput({ onSend, disabled, onStop, members, replyToId, onCancelReply }: Props) {
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
    onSend(content, replyToId, mentionedIds.length > 0 ? mentionedIds : undefined);
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
    <div className="border-t border-gray-200 dark:border-gray-800/50 bg-gray-50 dark:bg-gray-900/80 backdrop-blur-sm px-4 py-3">
      {/* Members bar for group chat */}
      {members && members.length > 1 && (
        <div className="flex items-center gap-2 mb-2 max-w-4xl mx-auto">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {members.length} 个 Agent 参与
          </span>
          <div className="flex gap-1">
            {members.slice(0, 5).map((m) => (
              <span key={m.agentId} className="text-xs bg-gray-100 dark:bg-gray-800/50 px-1.5 py-0.5 rounded-lg text-gray-400 dark:text-gray-500">
                @{m.agentName}
              </span>
            ))}
            {members.length > 5 && (
              <span className="text-xs text-gray-400 dark:text-gray-600">+{members.length - 5}</span>
            )}
          </div>
        </div>
      )}

      {/* Pill-shaped input container */}
      <div className="flex items-end gap-2 max-w-4xl mx-auto bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 rounded-2xl px-2 py-1.5 focus-within:border-blue-500/50 focus-within:bg-gray-200 dark:focus-within:bg-gray-800/70 transition-colors relative">
        {/* File upload button — ChatGPT style */}
        <label className="flex-shrink-0 p-1.5 cursor-pointer text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700/50 rounded-xl transition-colors mb-0.5 group/upload relative" title="上传文件（文档、PDF、代码等）">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-800 dark:bg-gray-700 rounded-lg whitespace-nowrap opacity-0 group-hover/upload:opacity-100 transition-opacity pointer-events-none">
            上传文件
            <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800 dark:border-t-gray-700" />
          </span>
          <input
            type="file"
            className="hidden"
            accept=".txt,.md,.csv,.json,.xml,.yaml,.yml,.html,.css,.js,.ts,.jsx,.tsx,.py,.java,.go,.rs,.c,.cpp,.h,.sh,.rb,.php,.swift,.kt,.sql,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.log,.env,.cfg,.ini,.toml"
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                const content = reader.result as string;
                const prefix = `[文件: ${file.name}]\n\`\`\`\n${content.slice(0, 8000)}\n\`\`\`\n\n`;
                setText((prev) => prefix + prev);
                setTimeout(() => {
                  textareaRef.current?.focus();
                  if (textareaRef.current) {
                    textareaRef.current.style.height = "auto";
                    textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + "px";
                  }
                }, 50);
              };
              if (file.type.startsWith("text/") || file.name.match(/\.(txt|md|csv|json|xml|ya?ml|html?|css|jsx?|tsx?|py|java|go|rs|c|cpp|h|sh|rb|php|swift|kt|sql|log|env|cfg|ini|toml)$/i)) {
                reader.readAsText(file);
              } else {
                setText((prev) => `[已附加文件: ${file.name} (${(file.size / 1024).toFixed(1)} KB)]\n\n` + prev);
              }
              e.target.value = "";
            }}
          />
        </label>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={members && members.length > 1 ? "输入消息，使用 @ 提及 Agent..." : "输入消息..."}
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none bg-transparent border-none rounded-2xl px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-0 disabled:opacity-50"
        />

        {/* @mention popover */}
        {showMentions && filteredMembers.length > 0 && (
          <div className="absolute bottom-full left-0 mb-1 w-56 bg-white dark:bg-gray-800/95 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 rounded-2xl shadow-xl z-20 max-h-40 overflow-y-auto">
            {filteredMembers.map((m, i) => (
              <button
                key={m.agentId}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(m.agentName);
                }}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 first:rounded-t-2xl last:rounded-b-2xl ${
                  i === mentionIdx ? "bg-gray-200 dark:bg-gray-700/80 text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50"
                }`}
              >
                <span className="text-xs text-gray-400 dark:text-gray-500">@</span>
                {m.agentName}
              </button>
            ))}
          </div>
        )}

        {disabled && onStop ? (
          <button
            onClick={onStop}
            className="px-4 py-2 bg-red-500/90 hover:bg-red-600 text-white rounded-xl text-sm font-medium whitespace-nowrap"
          >
            🛑 停止
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={disabled || !text.trim()}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium"
          >
            发送
          </button>
        )}
      </div>
    </div>
  );
}
