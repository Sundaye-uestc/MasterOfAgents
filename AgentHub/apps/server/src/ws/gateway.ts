// ============================================================
// WebSocket Gateway — real-time event broadcasting via `ws`
// ============================================================

import { WebSocketServer, WebSocket } from "ws";
import type { AgentEvent, ServerWsEvent, ClientWsEvent } from "@agenthub/shared";

const rooms = new Map<string, Set<WebSocket>>();

/** Minimal interface for an HTTP server that supports listening */
interface HttpServerLike {
  on(event: string, listener: (...args: any[]) => void): void;
  close(callback?: () => void): void;
}

export function initWsGateway(httpServer: HttpServerLike): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer as any, path: "/ws" });

  wss.on("connection", (ws) => {
    console.log("[WS] client connected");

    ws.on("message", (raw) => {
      try {
        const event = JSON.parse(raw.toString()) as ClientWsEvent;
        handleClientEvent(ws, event);
      } catch {
        // ignore malformed messages
      }
    });

    ws.on("close", () => {
      leaveAllRooms(ws);
    });

    ws.on("error", () => {
      leaveAllRooms(ws);
    });
  });

  return wss;
}

function handleClientEvent(ws: WebSocket, event: ClientWsEvent) {
  switch (event.type) {
    case "join:conversation":
      joinRoom(event.conversationId, ws);
      ws.send(JSON.stringify({ type: "joined", conversationId: event.conversationId }));
      break;
    case "leave:conversation":
      leaveRoom(event.conversationId, ws);
      break;
    case "typing":
      broadcastToConversation(event.conversationId, { type: "typing", conversationId: event.conversationId });
      break;
  }
}

function joinRoom(conversationId: string, ws: WebSocket) {
  let room = rooms.get(conversationId);
  if (!room) {
    room = new Set();
    rooms.set(conversationId, room);
  }
  room.add(ws);
}

function leaveRoom(conversationId: string, ws: WebSocket) {
  const room = rooms.get(conversationId);
  if (room) {
    room.delete(ws);
    if (room.size === 0) rooms.delete(conversationId);
  }
}

function leaveAllRooms(ws: WebSocket) {
  for (const [, room] of rooms) {
    room.delete(ws);
  }
}

export function broadcastToConversation(conversationId: string, event: ServerWsEvent) {
  const room = rooms.get(conversationId);
  if (!room) return;
  const payload = JSON.stringify(event);
  for (const ws of room) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
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
      return { type: "tool:invocation", tool: event };
    case "tool_result":
      return { type: "tool:invocation", tool: event };
    case "file_change":
      return { type: "file:changed", change: event };
    case "artifact_created":
      return { type: "artifact:created", artifact: event };
    default:
      return null;
  }
}
