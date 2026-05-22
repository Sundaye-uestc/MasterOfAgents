// ============================================================
// AgentHub Server — Hono + WebSocket entry point (Phase 0: minimal)
// ============================================================

import { Hono } from "hono";
import { serve } from "@hono/node-server";

const app = new Hono();

// --- Health check ---
app.get("/health", (c) => c.json({ status: "ok", uptime: process.uptime() }));

// --- Placeholder REST endpoints (Phase 1+) ---
app.get("/api/agents", (c) => c.json({ agents: [] }));
app.get("/api/conversations", (c) => c.json({ conversations: [] }));

export { app };

// --- Start server only when this is the entry point ---
const PORT = parseInt(process.env["PORT"] ?? "3001", 10);

serve({
  fetch: app.fetch,
  port: PORT,
}, (info) => {
  console.log(`[AgentHub Server] listening on http://localhost:${info.port}`);
  console.log(`[AgentHub Server] health: http://localhost:${info.port}/health`);
});

// Graceful shutdown
function shutdown(signal: string) {
  console.log(`\n[AgentHub Server] ${signal} received, shutting down...`);
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
