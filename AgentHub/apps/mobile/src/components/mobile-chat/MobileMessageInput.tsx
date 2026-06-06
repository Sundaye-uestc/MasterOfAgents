import { useState, useRef, useCallback, useEffect } from "react";
import { MobileMentionPicker } from "./MobileMentionPicker.jsx";

interface MemberInfo {
  agentId: string;
  agentName: string;
  adapterKind: string;
  role?: string;
}

interface Props {
  onSend: (content: string, replyToId?: string, mentionedAgentId?: string) => void;
  onStop: () => void;
  running: boolean;
  members: MemberInfo[];
}

export function MobileMessageInput({ onSend, onStop, running, members }: Props) {
  const [text, setText] = useState("");
  const [showMention, setShowMention] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Handle keyboard visibility via visualViewport
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handler = () => {
      const inputBar = document.getElementById("mobile-input-bar");
      if (inputBar) {
        const offset = window.innerHeight - vv.height;
        inputBar.style.bottom = `${Math.max(0, offset)}px`;
      }
    };
    vv.addEventListener("resize", handler);
    return () => vv.removeEventListener("resize", handler);
  }, []);

  const handleSend = useCallback(() => {
    if (!text.trim() || running) return;
    onSend(text.trim());
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [text, running, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // Auto-resize textarea
  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, []);

  // Detect @mention trigger
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      handleInput(e);
      if (members.length > 0 && val.endsWith("@")) {
        setShowMention(true);
      } else {
        setShowMention(false);
      }
    },
    [handleInput, members.length]
  );

  const handleSelectMention = useCallback(
    (agentId: string, agentName: string) => {
      setText((prev) => prev.replace(/@$/, `@${agentName} `));
      setShowMention(false);
      textareaRef.current?.focus();
    },
    []
  );

  return (
    <div className="relative">
      {/* Mention picker */}
      {showMention && (
        <MobileMentionPicker members={members} onSelect={handleSelectMention} onClose={() => setShowMention(false)} />
      )}

      {/* Input bar */}
      <div
        id="mobile-input-bar"
        className="flex items-end gap-2 px-3 py-2 border-t border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 pb-safe"
        style={{ minHeight: "56px" }}
      >
        <div className="flex-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-2">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="输入消息..."
            rows={1}
            className="w-full bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 resize-none focus:outline-none"
            style={{ maxHeight: "120px" }}
          />
        </div>

        {running ? (
          <button
            onClick={onStop}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-red-500 text-white flex-shrink-0 active:bg-red-600 touch-target"
          >
            ■
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!text.trim()}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-600 text-white flex-shrink-0 active:bg-blue-700 disabled:opacity-50 touch-target"
          >
            ↑
          </button>
        )}
      </div>
    </div>
  );
}
