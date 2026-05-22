// ============================================================
// Agent REST routes
// ============================================================

import { Hono } from "hono";
import { getDb, schema } from "../db/index.js";
import { eq } from "drizzle-orm";
import { newId, nowISO } from "../lib/ids.js";

export const agentRoutes = new Hono();

// --- List agents ---
agentRoutes.get("/", (c) => {
  const db = getDb();
  const list = db.select().from(schema.agents).all();
  return c.json(list);
});

// --- Create agent ---
agentRoutes.post("/", async (c) => {
  const body = await c.req.json<{
    name: string;
    adapterKind: string;
    capabilities?: string[];
    systemPrompt?: string;
  }>();
  const db = getDb();
  const now = nowISO();
  const id = newId();
  const row = {
    id,
    name: body.name,
    slug: body.name.toLowerCase().replace(/\s+/g, "-"),
    adapterKind: body.adapterKind ?? "claude-code",
    configJson: JSON.stringify({ systemPrompt: body.systemPrompt ?? "" }),
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
  }>();
  const db = getDb();
  const now = nowISO();
  const id = newId();
  const row = {
    id,
    name: body.name,
    slug: body.name.toLowerCase().replace(/\s+/g, "-"),
    adapterKind: body.platform ?? "claude-code",
    configJson: JSON.stringify({ systemPrompt: body.systemPrompt ?? "" }),
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

// --- Get agent ---
agentRoutes.get("/:id", (c) => {
  const db = getDb();
  const agent = db.select().from(schema.agents).where(eq(schema.agents.id, c.req.param("id")!)).get();
  if (!agent) return c.json({ error: "Not found" }, 404);
  return c.json(agent);
});

// --- Update agent ---
agentRoutes.patch("/:id", async (c) => {
  const body = await c.req.json<{ name?: string; enabled?: boolean; systemPrompt?: string }>();
  const db = getDb();
  const updates: Record<string, any> = { updatedAt: nowISO() };
  if (body.name !== undefined) updates.name = body.name;
  if (body.enabled !== undefined) updates.enabled = body.enabled ? 1 : 0;
  if (body.systemPrompt !== undefined) {
    updates.configJson = JSON.stringify({ systemPrompt: body.systemPrompt });
  }
  db.update(schema.agents).set(updates).where(eq(schema.agents.id, c.req.param("id")!)).run();
  const agent = db.select().from(schema.agents).where(eq(schema.agents.id, c.req.param("id")!)).get();
  return c.json(agent);
});
