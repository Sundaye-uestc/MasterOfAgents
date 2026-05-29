// ============================================================
// Message Store — Zustand store for messages state
// ============================================================

import { create } from "zustand";
import type { MessageRow } from "@agenthub/shared";
import { listMessages, sendMessage, deleteMessage, pinMessage, getPinnedMessages, retryMessage } from "../lib/api.js";

interface ReplyTarget {
  messageId: string;
  content: string;
  role: string;
}

interface MessageState {
  messages: MessageRow[];
  pinnedMessages: MessageRow[];
  replyTarget: ReplyTarget | null;
  streamingMsgId: string | null;
  loading: boolean;

  // Actions
  load: (conversationId: string) => Promise<void>;
  send: (conversationId: string, content: string, agentId?: string) => Promise<MessageRow>;
  remove: (msgId: string) => Promise<void>;
  togglePin: (msgId: string, pinned: boolean) => Promise<void>;
  loadPinned: (conversationId: string) => Promise<void>;
  regenerate: (msgId: string) => Promise<{ runId: string }>;
  appendDelta: (msgId: string, delta: string) => void;
  setReplyTarget: (target: ReplyTarget | null) => void;
  setStreaming: (msgId: string | null) => void;
  completeMessage: (msgId: string) => void;
}

export const useMessageStore = create<MessageState>((set, get) => ({
  messages: [],
  pinnedMessages: [],
  replyTarget: null,
  streamingMsgId: null,
  loading: false,

  load: async (conversationId) => {
    set({ loading: true, messages: [] });
    try {
      const msgs = await listMessages(conversationId);
      set({ messages: msgs, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  send: async (conversationId, content, agentId) => {
    const result = await sendMessage(conversationId, content, undefined, agentId);
    set((s) => ({ messages: [...s.messages, result.userMessage] }));
    return result.userMessage;
  },

  remove: async (msgId) => {
    await deleteMessage(msgId);
    set((s) => ({ messages: s.messages.filter((m) => m.id !== msgId) }));
  },

  togglePin: async (msgId, pinned) => {
    await pinMessage(msgId, pinned);
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === msgId
          ? { ...m, metadataJson: pinned ? JSON.stringify({ pinned: true }) : null }
          : m
      ),
    }));
  },

  loadPinned: async (conversationId) => {
    try {
      const pinned = await getPinnedMessages(conversationId);
      set({ pinnedMessages: pinned });
    } catch {}
  },

  regenerate: async (msgId) => {
    const result = await retryMessage(msgId);
    return { runId: result.runId };
  },

  appendDelta: (msgId, delta) => {
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === msgId ? { ...m, content: (m.content ?? "") + delta } : m
      ),
    }));
  },

  setReplyTarget: (target) => set({ replyTarget: target }),
  setStreaming: (msgId) => set({ streamingMsgId: msgId }),

  completeMessage: (msgId) => {
    set((s) => ({
      streamingMsgId: s.streamingMsgId === msgId ? null : s.streamingMsgId,
      messages: s.messages.map((m) =>
        m.id === msgId && m.status === "streaming" ? { ...m, status: "sent" as const } : m
      ),
    }));
  },
}));