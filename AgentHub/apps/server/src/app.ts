// ============================================================
// AgentHub Server — Hono + WebSocket entry point
// ============================================================

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { conversationRoutes } from "./routes/conversations.js";
import { agentRoutes } from "./routes/agents.js";
import { runRoutes } from "./routes/runs.js";
import { initWsGateway } from "./ws/gateway.js";
import { initDb, saveDb } from "./db/index.js";
import { seedAgents } from "./db/seed.js";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

// Ensure data directory exists
const DATA_DIR = resolve(process.cwd(), "data");
mkdirSync(DATA_DIR, { recursive: true });

const app = new Hono();

// --- Health check ---
app.get("/health", (c) => c.json({ status: "ok", uptime: process.uptime() }));

// --- REST API ---
app.route("/api/conversations", conversationRoutes);
app.route("/api/agents", agentRoutes);
app.route("/api/runs", runRoutes);

export { app };

// --- Start server ---
const PORT = parseInt(process.env["PORT"] ?? "3001", 10);

async function main() {
  // Initialize database
  await initDb();
  seedAgents();
  console.log("[AgentHub] Database initialized");

  const server = serve({
    fetch: app.fetch,
    port: PORT,
  }, (info) => {
    console.log(`[AgentHub Server] REST http://localhost:${info.port}`);
    console.log(`[AgentHub Server] WS   ws://localhost:${info.port}/ws`);
  });

  // Attach WebSocket server
  initWsGateway(server);

  // Periodic DB save (every 30 seconds)
  const saveInterval = setInterval(() => {
    try { saveDb(); } catch { /* ignore */ }
  }, 30_000);

  // Graceful shutdown
  function shutdown(signal: string) {
    console.log(`\n[AgentHub Server] ${signal} received, shutting down...`);
    clearInterval(saveInterval);
    try { saveDb(); } catch { /* ignore */ }
    server.close();
    process.exit(0);
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
