// ============================================================
// useOrchestrationState — tracks orchestrated run state
// Updated by WebSocket events.
// ============================================================

import { useState, useCallback } from "react";
import type { WsServerEvent } from "./useWebSocket.js";

interface TaskInfo {
  id: string;
  title: string;
  description?: string;
  agentId?: string;
  agentName?: string;
  adapterKind?: string;
  status: string;
  dependencies?: string[];
}

interface OrchestrationState {
  runId: string | null;
  runStatus: string;
  tasks: TaskInfo[];
  progress: { completed: number; total: number };
}

export function useOrchestrationState(): {
  state: OrchestrationState;
  handleWsEvent: (event: WsServerEvent) => void;
  reset: () => void;
} {
  const [state, setState] = useState<OrchestrationState>({
    runId: null,
    runStatus: "",
    tasks: [],
    progress: { completed: 0, total: 0 },
  });

  const reset = useCallback(() => {
    setState({
      runId: null,
      runStatus: "",
      tasks: [],
      progress: { completed: 0, total: 0 },
    });
  }, []);

  const handleWsEvent = useCallback((event: WsServerEvent) => {
    switch (event.type) {
      case "run:started":
        setState((prev) => ({ ...prev, runId: event.runId, runStatus: "running" }));
        break;

      case "orchestrator:plan_created": {
        const plan = event.plan as any;
        const tasks: TaskInfo[] = (plan?.tasks ?? []).map((t: any) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          agentId: t.agentId,
          status: "queued",
          dependencies: t.dependencies,
        }));
        setState((prev) => ({
          ...prev,
          tasks,
          progress: { completed: 0, total: tasks.length },
        }));
        break;
      }

      case "task:started":
        setState((prev) => ({
          ...prev,
          tasks: prev.tasks.map((t) =>
            t.id === event.taskId ? { ...t, status: "running" } : t
          ),
        }));
        break;

      case "task:completed":
        setState((prev) => {
          const updated = prev.tasks.map((t) =>
            t.id === event.taskId ? { ...t, status: "completed" } : t
          );
          const completed = updated.filter((t) => t.status === "completed").length;
          return {
            ...prev,
            tasks: updated,
            progress: { ...prev.progress, completed },
          };
        });
        break;

      case "task:failed":
        setState((prev) => ({
          ...prev,
          tasks: prev.tasks.map((t) =>
            t.id === event.taskId ? { ...t, status: "failed" } : t
          ),
        }));
        break;

      case "run:completed":
      case "run:failed":
        setState((prev) => ({ ...prev, runStatus: event.type === "run:completed" ? "completed" : "failed" }));
        break;
    }
  }, []);

  return { state, handleWsEvent, reset };
}
