// ============================================================
// Connection Registry — manages WebSocket connection lifecycle
// ============================================================

import type { WebSocket } from "ws";

let nextId = 1;

export interface ConnectionInfo {
  id: string;
  ws: WebSocket;
  conversationId: string | null;
  connectedAt: number;
  lastHeartbeat: number;
}

export class ConnectionRegistry {
  private connections = new Map<string, ConnectionInfo>();
  private rooms = new Map<string, Set<string>>();  // conversationId -> Set<connectionId>

  /** Register a new WebSocket connection */
  register(ws: WebSocket): string {
    const id = `conn_${nextId++}_${Date.now()}`;
    this.connections.set(id, {
      id,
      ws,
      conversationId: null,
      connectedAt: Date.now(),
      lastHeartbeat: Date.now(),
    });
    return id;
  }

  /** Remove a connection and leave all its rooms */
  unregister(connectionId: string): void {
    const conn = this.connections.get(connectionId);
    if (!conn) return;

    // Leave all rooms this connection was in
    if (conn.conversationId) {
      this.leaveRoom(connectionId, conn.conversationId);
    }
    this.connections.delete(connectionId);
  }

  /** Join a conversation room */
  joinRoom(connectionId: string, conversationId: string): void {
    // Leave previous room first
    const conn = this.connections.get(connectionId);
    if (!conn) return;
    if (conn.conversationId && conn.conversationId !== conversationId) {
      this.leaveRoom(connectionId, conn.conversationId);
    }

    let room = this.rooms.get(conversationId);
    if (!room) {
      room = new Set();
      this.rooms.set(conversationId, room);
    }
    room.add(connectionId);
    conn.conversationId = conversationId;
  }

  /** Leave a conversation room */
  leaveRoom(connectionId: string, conversationId: string): void {
    const conn = this.connections.get(connectionId);
    if (conn && conn.conversationId === conversationId) {
      conn.conversationId = null;
    }
    const room = this.rooms.get(conversationId);
    if (room) {
      room.delete(connectionId);
      if (room.size === 0) {
        this.rooms.delete(conversationId);
      }
    }
  }

  /** Get all connection IDs in a room */
  getRoom(conversationId: string): Set<string> {
    return this.rooms.get(conversationId) ?? new Set();
  }

  /** Get connection info by ID */
  getConnection(connectionId: string): ConnectionInfo | undefined {
    return this.connections.get(connectionId);
  }

  /** Update heartbeat timestamp */
  heartbeat(connectionId: string): void {
    const conn = this.connections.get(connectionId);
    if (conn) {
      conn.lastHeartbeat = Date.now();
    }
  }

  /** Total active connections */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /** Total active rooms */
  getRoomCount(): number {
    return this.rooms.size;
  }
}

/** Singleton registry instance */
export const connectionRegistry = new ConnectionRegistry();
