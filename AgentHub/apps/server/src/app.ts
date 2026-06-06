// ============================================================
// AgentHub Server — Hono + WebSocket entry point
// ============================================================

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { conversationRoutes } from "./routes/conversations.js";
import { agentRoutes } from "./routes/agents.js";
import { runRoutes } from "./routes/runs.js";
import { workspaceRoutes } from "./routes/workspaces.js";
import { fileChangeRoutes } from "./routes/file-changes.js";
import { artifactRoutes } from "./routes/artifacts.js";
import { deploymentRoutes } from "./routes/deployments.js";
import { secretRoutes } from "./routes/secrets.js";
import { profileRoutes } from "./routes/profile.js";
import { initWsGateway } from "./ws/gateway.js";
import { initDb, saveDb } from "./db/index.js";
import { seedAgents } from "./db/seed.js";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { crashLog, clearCrashLog } from "./lib/crash-log.js";

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
app.route("/api/workspaces", workspaceRoutes);
app.route("/api/file-changes", fileChangeRoutes);
app.route("/api/artifacts", artifactRoutes);
app.route("/api/deployments", deploymentRoutes);
app.route("/api/secrets", secretRoutes);
app.route("/api/profile", profileRoutes);

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

  // Prevent EPIPE errors from crashing the process when the parent
  // (Python launcher or tsx) closes the pipe.
  process.stdout.on("error", (err) => {
    if ((err as any)?.code === "EPIPE") return;
    crashLog(`stdout error: ${(err as any)?.message || String(err)}`);
  });
  process.stderr.on("error", (err) => {
    if ((err as any)?.code === "EPIPE") return;
    crashLog(`stderr error: ${(err as any)?.message || String(err)}`);
  });

  // Global error handlers — prevent crashes from unhandled async errors
  process.on("uncaughtException", (err) => {
    crashLog(`FATAL uncaughtException: ${err?.message || String(err)}`);
    console.error(`[FATAL] Uncaught exception:`, err);
  });
  process.on("unhandledRejection", (reason: any) => {
    crashLog(`FATAL unhandledRejection: ${reason?.message || String(reason)}`);
    console.error(`[FATAL] Unhandled rejection:`, reason);
  });

  // Track process exit
  process.on("exit", (code) => {
    // Use synchronous write directly here since crashLog might not work during exit
    crashLog(`PROCESS EXIT code=${code}`);
  });
  process.on("beforeExit", (code) => {
    crashLog(`PROCESS beforeExit code=${code}`);
  });

  clearCrashLog();
  crashLog(`Server starting on port ${PORT} [PID=${process.pid}]`);

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
