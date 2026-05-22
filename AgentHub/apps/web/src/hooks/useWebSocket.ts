import { useEffect, useRef, useCallback } from "react";
import type { ServerWsEvent } from "@agenthub/shared";

export type WsServerEvent = ServerWsEvent;

export function useWebSocket(
  conversationId: string | null,
  onEvent: (event: WsServerEvent) => void
) {
  const wsRef = useRef<WebSocket | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!conversationId) return;

    // Connect directly to backend WS port in dev, same host in prod
    const wsHost = import.meta.env.DEV ? "localhost:3001" : location.host;
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${wsHost}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join:conversation", conversationId }));
    };

    ws.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as WsServerEvent;
        onEventRef.current(event);
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [conversationId]);

  const send = useCallback((event: { type: string; [key: string]: unknown }) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(event));
    }
  }, []);

  return { send };
}
