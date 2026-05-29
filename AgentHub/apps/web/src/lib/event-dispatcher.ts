// ============================================================
// Event Dispatcher — automatic WS event → store dispatch
// ============================================================

import type { ServerWsEvent } from "@agenthub/shared";
import { useMessageStore } from "../stores/message.store.js";
import { useRunStore } from "../stores/run.store.js";
import { useArtifactStore } from "../stores/artifact.store.js";
import { useWorkspaceStore } from "../stores/workspace.store.js";
import type { MessageRow, FileChangeRow, ArtifactRow } from "@agenthub/shared";

/**
 * Dispatch a WS server event to the appropriate Zustand stores.
 * Call this from your WebSocket onmessage handler.
 */
export function dispatchServerEvent(event: ServerWsEvent): void {
  switch (event.type) {
    case "message:created": {
      const msg = event.message as MessageRow;
      useMessageStore.setState((s) => ({
        messages: s.messages.some((m) => m.id === msg.id) ? s.messages : [...s.messages, msg],
      }));
      break;
    }

    case "message:delta": {
      useMessageStore.getState().appendDelta(event.messageId, event.delta);
      break;
    }

    case "message:completed": {
      useMessageStore.getState().completeMessage(event.messageId);
      useRunStore.getState().setRunning(false, null);
      break;
    }

    case "run:started":
      useRunStore.getState().setRunning(true, event.runId);
      break;

    case "run:completed":
      useRunStore.getState().setRunning(false, null);
      break;

    case "run:failed":
      useRunStore.getState().setRunning(false, null);
      break;

    case "task:started":
      useRunStore.getState().setOrch({
        tasks: useRunStore.getState().orch.tasks.map((t) =>
          t.id === event.taskId ? { ...t, status: "running" } : t
        ),
      });
      break;

    case "task:completed":
      useRunStore.getState().setOrch({
        tasks: useRunStore.getState().orch.tasks.map((t) =>
          t.id === event.taskId ? { ...t, status: "completed" } : t
        ),
      });
      break;

    case "task:failed":
      useRunStore.getState().setOrch({
        tasks: useRunStore.getState().orch.tasks.map((t) =>
          t.id === event.taskId ? { ...t, status: "failed" } : t
        ),
      });
      break;

    case "tool:invocation": {
      const inv = (event as any).invocation;
      const msgId = (event as any).messageId as string;
      if (!inv || !msgId) break;

      if (inv.type === "tool_call") {
        useRunStore.getState().addToolCall(msgId, {
          id: inv.toolCallId,
          toolName: inv.toolName,
          inputJson: JSON.stringify(inv.input),
          status: "running",
        });
      } else if (inv.type === "tool_result") {
        useRunStore.getState().updateToolResult(
          msgId,
          inv.toolCallId,
          inv.output ?? "",
          inv.isError ?? false
        );
      }
      break;
    }

    case "file:changed": {
      const fc = (event as any).change as FileChangeRow;
      if (!fc) break;
      useWorkspaceStore.getState().updateFileChange(fc);
      break;
    }

    case "artifact:created": {
      const art = (event as any).artifact;
      if (!art) break;
      useArtifactStore.setState((s) => ({
        artifacts: s.artifacts.some((a) => a.id === art.id)
          ? s.artifacts
          : [art as ArtifactRow, ...s.artifacts],
      }));
      break;
    }

    case "deploy:status": {
      const dep = (event as any).deployment;
      if (!dep) break;
      useArtifactStore.getState().addDeployment(dep);
      break;
    }

    default:
      break;
  }
}