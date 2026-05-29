// ============================================================
// File Changes Routes — apply, revert, list
// ============================================================

import { Hono } from "hono";
import { WorkspaceService } from "../services/workspace.service.js";
import { broadcastToConversation } from "../ws/gateway.js";
import { getDb, schema } from "../db/index.js";
import { eq } from "drizzle-orm";

const svc = new WorkspaceService();
export const fileChangeRoutes = new Hono();

// --- Get file change by ID ---
fileChangeRoutes.get("/:id", async (c) => {
  const fc = await svc.getFileChange(c.req.param("id")!);
  if (!fc) return c.json({ error: "Not found" }, 404);
  return c.json(fc);
});

// --- List file changes by run ---
fileChangeRoutes.get("/by-run/:runId", async (c) => {
  const changes = await svc.listFileChangesByRun(c.req.param("runId")!);
  return c.json(changes);
});

// --- List file changes by conversation ---
fileChangeRoutes.get("/by-conversation/:conversationId", async (c) => {
  const changes = await svc.listFileChangesByConversation(c.req.param("conversationId")!);
  return c.json(changes);
});

// --- Apply file change ---
fileChangeRoutes.post("/:id/apply", async (c) => {
  const id = c.req.param("id")!;
  const fc = await svc.applyFileChange(id);
  if (!fc) return c.json({ error: "Not found" }, 404);

  // Broadcast the status change via WS
  const db = getDb();
  const run = db.select().from(schema.runs).where(eq(schema.runs.id, fc.runId)).get() as any;
  if (run) {
    broadcastToConversation(run.conversationId, {
      type: "file:changed",
      change: fc,
    });
  }

  return c.json(fc);
});

// --- Revert file change ---
fileChangeRoutes.post("/:id/revert", async (c) => {
  const id = c.req.param("id")!;
  const fc = await svc.revertFileChange(id);
  if (!fc) return c.json({ error: "Not found" }, 404);

  // Broadcast the status change via WS
  const db = getDb();
  const run = db.select().from(schema.runs).where(eq(schema.runs.id, fc.runId)).get() as any;
  if (run) {
    broadcastToConversation(run.conversationId, {
      type: "file:changed",
      change: fc,
    });
  }

  return c.json(fc);
});
