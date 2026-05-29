// ============================================================
// Run Store — Zustand store for active runs, tasks, tool invocations
// ============================================================

import { create } from "zustand";
import type { RunRow } from "@agenthub/shared";
import { getActiveRuns, stopRun } from "../lib/api.js";

interface TaskState {
  id: string;
  runId: string;
  title: string;
  status: string;
  agentId: string | null;
}

interface ToolInvocation {
  id: string;
  toolName: string;
  inputJson?: string;
  outputJson?: string;
  status: string;
}

interface OrchestrationState {
  runId: string | null;
  runStatus: string | null;
  tasks: TaskState[];
  progress: { completed: number; total: number } | null;
}

interface RunState {
  runs: RunRow[];
  toolsByMessage: Record<string, ToolInvocation[]>;
  orch: OrchestrationState;
  running: boolean;
  currentRunId: string | null;

  loadActive: () => Promise<void>;
  stop: (runId: string) => Promise<void>;
  addToolCall: (msgId: string, tool: ToolInvocation) => void;
  updateToolResult: (msgId: string, toolId: string, outputJson: string, isError: boolean) => void;
  setOrch: (updates: Partial<OrchestrationState>) => void;
  resetOrch: () => void;
  setRunning: (v: boolean, runId?: string | null) => void;
}

export const useRunStore = create<RunState>((set) => ({
  runs: [],
  toolsByMessage: {},
  orch: { runId: null, runStatus: null, tasks: [], progress: null },
  running: false,
  currentRunId: null,

  loadActive: async () => {
    try {
      const runs = await getActiveRuns() as RunRow[];
      set({ runs });
    } catch {}
  },

  stop: async (runId) => {
    await stopRun(runId);
    set({ running: false, currentRunId: null });
  },

  addToolCall: (msgId, tool) => {
    set((s) => {
      const list = s.toolsByMessage[msgId] ?? [];
      if (list.some((t) => t.id === tool.id)) return s;
      return {
        toolsByMessage: { ...s.toolsByMessage, [msgId]: [...list, tool] },
      };
    });
  },

  updateToolResult: (msgId, toolId, outputJson, isError) => {
    set((s) => {
      const list = s.toolsByMessage[msgId];
      if (!list) return s;
      return {
        toolsByMessage: {
          ...s.toolsByMessage,
          [msgId]: list.map((t) =>
            t.id === toolId
              ? { ...t, outputJson, status: isError ? "error" : "success" }
              : t
          ),
        },
      };
    });
  },

  setOrch: (updates) => set((s) => ({ orch: { ...s.orch, ...updates } })),
  resetOrch: () => set({ orch: { runId: null, runStatus: null, tasks: [], progress: null } }),
  setRunning: (v, runId) => set({ running: v, currentRunId: runId ?? null }),
}));