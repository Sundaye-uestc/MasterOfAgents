// ============================================================
// Agent Store — Zustand store for agents state
// ============================================================

import { create } from "zustand";
import type { AgentRow } from "@agenthub/shared";
import { listAgents, createAgentFromDraft } from "../lib/api.js";

interface AgentState {
  agents: AgentRow[];
  capabilityFilter: string | null;
  loading: boolean;

  load: () => Promise<void>;
  createFromDraft: (draft: { name: string; platform?: string; capabilities?: string[]; systemPrompt?: string }) => Promise<AgentRow>;
  setCapabilityFilter: (cap: string | null) => void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: [],
  capabilityFilter: null,
  loading: false,

  load: async () => {
    set({ loading: true });
    try {
      const agents = await listAgents();
      set({ agents, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  createFromDraft: async (draft) => {
    const agent = await createAgentFromDraft(draft);
    await get().load();
    return agent;
  },

  setCapabilityFilter: (cap) => set({ capabilityFilter: cap }),
}));