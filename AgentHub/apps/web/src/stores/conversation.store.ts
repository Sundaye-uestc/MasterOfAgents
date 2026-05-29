// ============================================================
// Conversation Store — Zustand store for conversation state
// ============================================================

import { create } from "zustand";
import type { ConversationRow } from "@agenthub/shared";
import {
  listConversations,
  createConversation,
  deleteConversation,
  renameConversation,
  pinConversation,
  archiveConversation,
  unarchiveConversation,
  getConversationAgentsMap,
} from "../lib/api.js";

interface ConversationState {
  conversations: ConversationRow[];
  agentMap: Record<string, { agentId: string; agentName: string; adapterKind: string }>;
  searchQuery: string;
  showArchived: boolean;
  loading: boolean;

  // Actions
  load: () => Promise<void>;
  search: (q: string) => Promise<void>;
  create: (title: string, type: "direct" | "group", agentId?: string, agentIds?: string[]) => Promise<ConversationRow>;
  remove: (id: string) => Promise<void>;
  rename: (id: string, title: string) => Promise<void>;
  togglePin: (id: string, pinned: boolean) => Promise<void>;
  archive: (id: string) => Promise<void>;
  unarchive: (id: string) => Promise<void>;
  setSearchQuery: (q: string) => void;
  setShowArchived: (show: boolean) => void;
  updateStatus: (id: string, status: "active" | "archived") => void;
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  conversations: [],
  agentMap: {},
  searchQuery: "",
  showArchived: false,
  loading: false,

  load: async () => {
    set({ loading: true });
    try {
      const [convs, map] = await Promise.all([
        listConversations(get().searchQuery || undefined),
        (getConversationAgentsMap as any)(),
      ]);
      set({ conversations: convs, agentMap: map, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  search: async (q: string) => {
    set({ searchQuery: q, loading: true });
    try {
      const convs = await listConversations(q || undefined);
      set({ conversations: convs, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  create: async (title, type, agentId, agentIds) => {
    const conv = await createConversation(title, type, agentId, agentIds);
    await get().load();
    return conv;
  },

  remove: async (id) => {
    await deleteConversation(id);
    set((s) => ({ conversations: s.conversations.filter((c) => c.id !== id) }));
  },

  rename: async (id, title) => {
    await renameConversation(id, title);
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === id ? { ...c, title, updatedAt: new Date().toISOString() } : c
      ),
    }));
  },

  togglePin: async (id, pinned) => {
    await pinConversation(id, pinned);
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === id ? { ...c, pinnedAt: pinned ? new Date().toISOString() : null } : c
      ),
    }));
  },

  archive: async (id) => {
    await archiveConversation(id);
    get().updateStatus(id, "archived");
  },

  unarchive: async (id) => {
    await unarchiveConversation(id);
    get().updateStatus(id, "active");
  },

  setSearchQuery: (q) => set({ searchQuery: q }),
  setShowArchived: (show) => set({ showArchived: show }),

  updateStatus: (id, status) => {
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === id ? { ...c, status } : c
      ),
    }));
  },
}));