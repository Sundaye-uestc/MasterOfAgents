// ============================================================
// Agent Store — Zustand store for agents state
// ============================================================

import { create } from "zustand";
import type { AgentRow } from "@agenthub/shared";
import { listAgents, createAgentFromDraft, updateAgent, deleteAgent } from "../lib/api.js";

interface AgentState {
  agents: AgentRow[];
  capabilityFilter: string | null;
  loading: boolean;

  load: () => Promise<void>;
  createFromDraft: (draft: {
    name: string;
    platform?: string;
    capabilities?: string[];
    systemPrompt?: string;
    toolSetIds?: string[];
  }) => Promise<AgentRow>;
  update: (
    id: string,
    data: {
      name?: string;
      enabled?: boolean;
      systemPrompt?: string;
      capabilities?: string[];
      toolSetIds?: string[];
      avatar?: string;
      status?: string;
    }
  ) => Promise<AgentRow>;
  remove: (id: string) => Promise<void>;
  toggleEnabled: (id: string, enabled: boolean) => Promise<void>;
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

  update: async (id, data) => {
    const agent = await updateAgent(id, data);
    set((s) => ({ agents: s.agents.map((a) => (a.id === id ? agent : a)) }));
    return agent;
  },

  remove: async (id) => {
    await deleteAgent(id);
    set((s) => ({ agents: s.agents.filter((a) => a.id !== id) }));
  },

  toggleEnabled: async (id, enabled) => {
    await updateAgent(id, { enabled });
    set((s) => ({
      agents: s.agents.map((a) => (a.id === id ? { ...a, enabled: enabled ? 1 : 0 } as AgentRow : a)),
    }));
  },

  setCapabilityFilter: (cap) => set({ capabilityFilter: cap }),
}));