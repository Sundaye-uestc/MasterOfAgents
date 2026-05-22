// ============================================================
// Run REST routes
// ============================================================

import { Hono } from "hono";
import { getDb, schema } from "../db/index.js";
import { eq, desc } from "drizzle-orm";
import { AgentRuntimeService } from "../services/agent-runtime.service.js";

const runtime = new AgentRuntimeService();

export const runRoutes = new Hono();

// --- Get run ---
runRoutes.get("/:id", (c) => {
  const db = getDb();
  const run = db.select().from(schema.runs).where(eq(schema.runs.id, c.req.param("id")!)).get();
  if (!run) return c.json({ error: "Not found" }, 404);
  return c.json(run);
});

// --- Stop run ---
runRoutes.post("/:id/stop", async (c) => {
  await runtime.stopRun(c.req.param("id")!);
  return c.json({ ok: true });
});

// --- Active runs ---
runRoutes.get("/", (c) => {
  const db = getDb();
  const active = db
    .select()
    .from(schema.runs)
    .where(eq(schema.runs.status, "running"))
    .orderBy(desc(schema.runs.createdAt))
    .all();
  return c.json(active);
});

// --- Tool invocations for a run ---
runRoutes.get("/:id/tools", (c) => {
  const db = getDb();
  const tools = db
    .select()
    .from(schema.toolInvocations)
    .where(eq(schema.toolInvocations.runId, c.req.param("id")!))
    .all();
  return c.json(tools);
});

// --- File changes for a run ---
runRoutes.get("/:id/files", (c) => {
  const db = getDb();
  const files = db
    .select()
    .from(schema.fileChanges)
    .where(eq(schema.fileChanges.runId, c.req.param("id")!))
    .all();
  return c.json(files);
});
