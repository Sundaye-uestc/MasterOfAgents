// ============================================================
// Artifact Routes — artifact CRUD + deploy
// ============================================================

import { Hono } from "hono";
import { ArtifactService } from "../services/artifact.service.js";
import { broadcastToConversation } from "../ws/gateway.js";
import { getDb, schema } from "../db/index.js";
import { eq } from "drizzle-orm";
import * as fs from "node:fs";
import * as path from "node:path";

const svc = new ArtifactService();
export const artifactRoutes = new Hono();

// --- Get artifact ---
artifactRoutes.get("/:id", async (c) => {
  const art = await svc.getArtifact(c.req.param("id")!);
  if (!art) return c.json({ error: "Not found" }, 404);
  return c.json(art);
});

// --- List by run ---
artifactRoutes.get("/by-run/:runId", async (c) => {
  const arts = await svc.listArtifactsByRun(c.req.param("runId")!);
  return c.json(arts);
});

// --- List by conversation ---
artifactRoutes.get("/by-conversation/:conversationId", async (c) => {
  const arts = await svc.listArtifactsByConversation(c.req.param("conversationId")!);
  return c.json(arts);
});

// --- Create artifact ---
artifactRoutes.post("/", async (c) => {
  const body = await c.req.json<{
    runId: string;
    messageId?: string;
    type: "file" | "diff" | "webpage" | "archive";
    name: string;
    filePath?: string;
    mimeType?: string;
    size?: number;
    metadata?: Record<string, unknown>;
    rootPath?: string;
  }>();
  const art = await svc.createArtifact(body);
  return c.json(art, 201);
});

// --- Deploy artifact ---
artifactRoutes.post("/:id/deploy", async (c) => {
  const art = await svc.getArtifact(c.req.param("id")!);
  if (!art) return c.json({ error: "Not found" }, 404);

  // For MVP: "deploy" means providing the static file path for preview
  const body = await c.req.json<{ target?: "local-static" | "zip" }>().catch(() => ({ target: "local-static" as const }));
  const target = body.target ?? "local-static";

  // Store deployment status
  const db = getDb();
  const now = new Date().toISOString();
  db.insert(schema.deployments).values({
    id: `deploy-${Date.now()}`,
    artifactId: art.id,
    runId: art.runId,
    status: "deployed",
    target,
    url: art.previewUrl,
    log: JSON.stringify({ message: `Deployed via ${target}` }),
    createdAt: now,
    completedAt: now,
  }).run();

  // Broadcast deployment status via WS
  const run = db.select().from(schema.runs).where(eq(schema.runs.id, art.runId ?? "")).get() as any;
  if (run) {
    broadcastToConversation(run.conversationId, {
      type: "deploy:status",
      deployment: { id: `deploy-${Date.now()}`, artifactId: art.id, status: "deployed", url: art.previewUrl },
    });
  }

  return c.json({ ok: true, previewUrl: art.previewUrl });
});

// --- Serve artifact static files ---
artifactRoutes.get("/static/:id/:filename", async (c) => {
  const art = await svc.getArtifact(c.req.param("id")!);
  if (!art) return c.json({ error: "Not found" }, 404);

  const filePath = svc.getArtifactFilePath(art);
  if (!filePath || !fs.existsSync(filePath)) {
    return c.json({ error: "File not found" }, 404);
  }

  const content = fs.readFileSync(filePath);
  const mimeType = art.mimeType ?? "application/octet-stream";
  return new Response(content, {
    headers: { "Content-Type": mimeType, "Cache-Control": "public, max-age=3600" },
  });
});