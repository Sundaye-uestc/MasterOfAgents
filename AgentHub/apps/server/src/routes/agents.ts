// ============================================================
// Agent REST routes
// ============================================================

import { Hono } from "hono";
import { getDb, schema } from "../db/index.js";
import { eq } from "drizzle-orm";
import { newId, nowISO } from "../lib/ids.js";
import { AgentBuilderService } from "../services/agent-builder.service.js";
import { getToolSetPromptInjection, stripToolSetInjection } from "@agenthub/shared";

export const agentRoutes = new Hono();

// --- List agents ---
// Query: ?enabled=true|false  (default: no filter = all)
agentRoutes.get("/", (c) => {
  const db = getDb();
  const enabledFilter = c.req.query("enabled");
  if (enabledFilter === "true") {
    return c.json(
      db.select().from(schema.agents).where(eq(schema.agents.enabled, 1)).all()
    );
  }
  if (enabledFilter === "false") {
    return c.json(
      db.select().from(schema.agents).where(eq(schema.agents.enabled, 0)).all()
    );
  }
  return c.json(db.select().from(schema.agents).all());
});

// --- Create agent ---
agentRoutes.post("/", async (c) => {
  const body = await c.req.json<{
    name: string;
    adapterKind: string;
    capabilities?: string[];
    systemPrompt?: string;
    toolSetIds?: string[];
  }>();
  const db = getDb();
  const now = nowISO();
  const id = newId();

  let systemPrompt = body.systemPrompt ?? "";
  if (body.toolSetIds && body.toolSetIds.length > 0) {
    systemPrompt += getToolSetPromptInjection(body.toolSetIds);
  }

  const row = {
    id,
    name: body.name,
    slug: body.name.toLowerCase().replace(/\s+/g, "-"),
    adapterKind: body.adapterKind ?? "claude-code",
    configJson: JSON.stringify({ systemPrompt }),
    capabilitiesJson: JSON.stringify(body.capabilities ?? []),
    status: "unknown",
    isCustom: body.adapterKind === "custom" ? 1 : 0,
    enabled: 1,
    createdAt: now,
    updatedAt: now,
  };
  db.insert(schema.agents).values(row).run();
  return c.json(row, 201);
});

// --- Create agent from draft (conversational) ---
agentRoutes.post("/from-draft", async (c) => {
  const body = await c.req.json<{
    name: string;
    platform?: string;
    capabilities?: string[];
    systemPrompt?: string;
    toolSetIds?: string[];
  }>();
  const db = getDb();
  const now = nowISO();
  const id = newId();

  // Inject tool set descriptions into system prompt
  let systemPrompt = body.systemPrompt ?? "";
  if (body.toolSetIds && body.toolSetIds.length > 0) {
    systemPrompt += getToolSetPromptInjection(body.toolSetIds);
  }

  const row = {
    id,
    name: body.name,
    slug: body.name.toLowerCase().replace(/\s+/g, "-"),
    adapterKind: body.platform ?? "claude-code",
    configJson: JSON.stringify({ systemPrompt, toolSetIds: body.toolSetIds ?? [] }),
    capabilitiesJson: JSON.stringify(body.capabilities ?? []),
    status: "online",
    isCustom: 1,
    enabled: 1,
    createdAt: now,
    updatedAt: now,
  };
  db.insert(schema.agents).values(row).run();
  return c.json(row, 201);
});

// --- Parse user description into structured agent config (LLM) ---
agentRoutes.post("/parse-intent", async (c) => {
  const body = await c.req.json<{ description: string }>();
  if (!body.description || !body.description.trim()) {
    return c.json({ error: "description is required" }, 400);
  }

  try {
    const builder = new AgentBuilderService();
    const result = await builder.parseCreationIntent(body.description.trim());
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[AgentRoutes] parse-intent failed:", message);
    return c.json({ error: message }, 500);
  }
});

// --- Polish system prompt (LLM) ---
agentRoutes.post("/polish-prompt", async (c) => {
  const body = await c.req.json<{ draft: string }>();
  if (!body.draft || !body.draft.trim()) {
    return c.json({ error: "draft is required" }, 400);
  }

  try {
    const builder = new AgentBuilderService();
    const result = await builder.polishSystemPrompt(body.draft.trim());
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[AgentRoutes] polish-prompt failed:", message);
    return c.json({ error: message }, 500);
  }
});

// --- Get agent ---
agentRoutes.get("/:id", (c) => {
  const db = getDb();
  const agent = db
    .select()
    .from(schema.agents)
    .where(eq(schema.agents.id, c.req.param("id")!))
    .get();
  if (!agent) return c.json({ error: "Not found" }, 404);
  return c.json(agent);
});

// --- Update agent ---
agentRoutes.patch("/:id", async (c) => {
  const body = await c.req.json<{
    name?: string;
    enabled?: boolean;
    systemPrompt?: string;
    capabilities?: string[];
    toolSetIds?: string[];
    avatar?: string;
    status?: string;
  }>();
  const db = getDb();
  const agent = db
    .select()
    .from(schema.agents)
    .where(eq(schema.agents.id, c.req.param("id")!))
    .get();
  if (!agent) return c.json({ error: "Not found" }, 404);

  const updates: Record<string, any> = { updatedAt: nowISO() };
  if (body.name !== undefined) updates.name = body.name;
  if (body.enabled !== undefined) updates.enabled = body.enabled ? 1 : 0;
  if (body.status !== undefined) updates.status = body.status;
  if (body.avatar !== undefined) updates.avatar = body.avatar;

  if (body.capabilities !== undefined) {
    updates.capabilitiesJson = JSON.stringify(body.capabilities);
  }

  // Handle systemPrompt + toolSetIds update (strip old injection, append new)
  if (body.systemPrompt !== undefined || body.toolSetIds !== undefined) {
    const existingConfig = JSON.parse(agent.configJson ?? "{}");
    const newSystemPrompt = body.systemPrompt ?? existingConfig.systemPrompt ?? "";
    const newToolSetIds = body.toolSetIds ?? existingConfig.toolSetIds ?? [];

    const cleanedPrompt = stripToolSetInjection(newSystemPrompt);
    const injection = getToolSetPromptInjection(newToolSetIds);

    updates.configJson = JSON.stringify({
      systemPrompt: cleanedPrompt + injection,
      toolSetIds: newToolSetIds,
    });
  }

  db.update(schema.agents)
    .set(updates)
    .where(eq(schema.agents.id, c.req.param("id")!))
    .run();

  const updated = db
    .select()
    .from(schema.agents)
    .where(eq(schema.agents.id, c.req.param("id")!))
    .get();
  return c.json(updated);
});

// --- Delete agent (custom only) ---
agentRoutes.delete("/:id", (c) => {
  const db = getDb();
  const agent = db
    .select()
    .from(schema.agents)
    .where(eq(schema.agents.id, c.req.param("id")!))
    .get();

  if (!agent) return c.json({ error: "Not found" }, 404);
  if (agent.isCustom === 0) {
    return c.json({ error: "Cannot delete built-in agents" }, 400);
  }

  db.delete(schema.agents)
    .where(eq(schema.agents.id, c.req.param("id")!))
    .run();

  return c.json({ ok: true });
});
