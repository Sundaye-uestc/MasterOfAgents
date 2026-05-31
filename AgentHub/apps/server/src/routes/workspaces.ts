// ============================================================
// Workspace Routes — workspace & snapshot CRUD
// ============================================================

import { Hono } from "hono";
import { WorkspaceService } from "../services/workspace.service.js";

const svc = new WorkspaceService();
export const workspaceRoutes = new Hono();

// --- Workspaces ---

workspaceRoutes.get("/", async (c) => {
  const conversationId = c.req.query("conversationId");
  if (conversationId) {
    const ws = await svc.getWorkspaceByConversation(conversationId);
    return c.json(ws ?? null);
  }
  return c.json({ error: "conversationId query parameter required" }, 400);
});

// --- Directory browser (browse any path) — must be before /:id ---

workspaceRoutes.get("/browse", async (c) => {
  const targetPath = c.req.query("path");
  if (!targetPath) return c.json({ error: "path query parameter required" }, 400);
  const tree = svc.buildFileTree(targetPath);
  return c.json(tree);
});

workspaceRoutes.get("/:id", async (c) => {
  const ws = await svc.getWorkspace(c.req.param("id")!);
  if (!ws) return c.json({ error: "Not found" }, 404);
  return c.json(ws);
});

workspaceRoutes.post("/", async (c) => {
  const body = await c.req.json<{ conversationId: string; rootPath: string }>();
  const ws = await svc.createWorkspace(body.conversationId, body.rootPath);
  return c.json(ws, 201);
});

workspaceRoutes.patch("/:id", async (c) => {
  const body = await c.req.json<{ rootPath?: string }>();
  const ws = await svc.updateWorkspace(c.req.param("id")!, body);
  if (!ws) return c.json({ error: "Not found" }, 404);
  return c.json(ws);
});

workspaceRoutes.delete("/:id", async (c) => {
  const ok = await svc.deleteWorkspace(c.req.param("id")!);
  if (!ok) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

// --- Snapshots ---

workspaceRoutes.get("/:id/snapshots", async (c) => {
  const snapshots = await svc.listSnapshots(c.req.param("id")!);
  return c.json(snapshots);
});

workspaceRoutes.get("/:id/snapshots/:snapshotId", async (c) => {
  const snap = await svc.getSnapshot(c.req.param("snapshotId")!);
  if (!snap) return c.json({ error: "Not found" }, 404);
  return c.json(snap);
});

workspaceRoutes.post("/:id/snapshots", async (c) => {
  const body = await c.req.json<{ runId: string; label: string; manifest: Record<string, unknown> }>();
  const snap = await svc.createSnapshot(c.req.param("id")!, body.runId, body.label, body.manifest);
  return c.json(snap, 201);
});

workspaceRoutes.post("/:id/snapshots/:snapshotId/rollback", async (c) => {
  const ok = await svc.rollbackToSnapshot(c.req.param("snapshotId")!);
  if (!ok) return c.json({ error: "Cannot rollback" }, 400);
  return c.json({ ok: true });
});

workspaceRoutes.delete("/:id/snapshots/:snapshotId", async (c) => {
  const ok = await svc.deleteSnapshot(c.req.param("snapshotId")!);
  if (!ok) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

// --- File tree ---

workspaceRoutes.get("/:id/files", async (c) => {
  const ws = await svc.getWorkspace(c.req.param("id")!);
  if (!ws) return c.json({ error: "Workspace not found" }, 404);
  const tree = svc.buildFileTree(ws.rootPath);
  return c.json(tree);
});

workspaceRoutes.get("/:id/file-content", async (c) => {
  const ws = await svc.getWorkspace(c.req.param("id")!);
  if (!ws) return c.json({ error: "Workspace not found" }, 404);
  const filePath = c.req.query("path");
  if (!filePath) return c.json({ error: "path query parameter required" }, 400);
  const result = svc.readFileContent(ws.rootPath, filePath);
  return c.json(result);
});
