// ============================================================
// WebSocket Gateway — real-time event broadcasting via `ws`
// ============================================================

import { WebSocketServer, WebSocket } from "ws";
import type { AgentEvent, ServerWsEvent, ClientWsEvent } from "@agenthub/shared";
import { getAgentRuntimeService } from "../services/agent-runtime.service.js";
import { connectionRegistry } from "./connection-registry.js";

const OPEN = WebSocket.OPEN;

/** Minimal interface for an HTTP server that supports listening */
interface HttpServerLike {
  on(event: string, listener: (...args: any[]) => void): void;
  close(callback?: () => void): void;
}

export function initWsGateway(httpServer: HttpServerLike): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer as any, path: "/ws" });

  wss.on("connection", (ws) => {
    const connId = connectionRegistry.register(ws);
    console.log(`[WS] client connected (${connId}), total: ${connectionRegistry.getConnectionCount()}`);

    ws.on("message", (raw) => {
      try {
        const event = JSON.parse(raw.toString()) as ClientWsEvent;
        handleClientEvent(connId, ws, event);
      } catch {
        // ignore malformed messages
      }
    });

    ws.on("close", () => {
      connectionRegistry.unregister(connId);
      console.log(`[WS] client disconnected (${connId}), remaining: ${connectionRegistry.getConnectionCount()}`);
    });

    ws.on("error", () => {
      connectionRegistry.unregister(connId);
    });
  });

  return wss;
}

async function handleClientEvent(connId: string, ws: WebSocket, event: ClientWsEvent) {
  switch (event.type) {
    case "join:conversation":
      connectionRegistry.joinRoom(connId, event.conversationId);
      ws.send(JSON.stringify({ type: "joined", conversationId: event.conversationId }));
      break;
    case "leave:conversation":
      connectionRegistry.leaveRoom(connId, event.conversationId);
      break;
    case "typing":
      broadcastToConversation(event.conversationId, { type: "typing", conversationId: event.conversationId });
      break;
    case "permission:respond": {
      const runtime = getAgentRuntimeService();
      await runtime.handlePermissionResponse(event.runId, event.permissionId, event.approved);
      break;
    }
  }
}

export function broadcastToConversation(conversationId: string, event: ServerWsEvent) {
  const connIds = connectionRegistry.getRoom(conversationId);
  if (connIds.size === 0) return;
  const payload = JSON.stringify(event);
  for (const connId of connIds) {
    const conn = connectionRegistry.getConnection(connId);
    if (conn && conn.ws.readyState === OPEN) {
      conn.ws.send(payload);
    }
  }
}

/** Map AgentEvent to WS broadcast event */
export function agentEventToWsEvent(event: AgentEvent): ServerWsEvent | null {
  switch (event.type) {
    case "run_started":
      return { type: "run:started", runId: event.runId };
    case "text_delta":
      return { type: "message:delta", messageId: "", delta: event.delta };
    case "run_completed":
      return { type: "run:completed", runId: event.runId };
    case "run_failed":
      return { type: "run:failed", runId: event.runId, error: event.error };
    case "tool_call":
      return { type: "tool:invocation", messageId: "", invocation: event };
    case "tool_result":
      return { type: "tool:invocation", messageId: "", invocation: event };
    case "file_change":
      return { type: "file:changed", change: event };
    case "artifact_created":
      return { type: "artifact:created", artifact: event };
    case "permission_request":
      return { type: "permission:requested", permission: event };
    default:
      return null;
  }
}
