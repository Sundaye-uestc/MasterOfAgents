// ============================================================
// Deployment Routes — deploy, download, status
// ============================================================

import { Hono } from "hono";
import { DeployService } from "../services/deploy.service.js";
import { WorkspaceService } from "../services/workspace.service.js";
import * as fs from "node:fs";

const deploySvc = new DeployService();
const workspaceSvc = new WorkspaceService();
export const deploymentRoutes = new Hono();

// --- Get deployment ---
deploymentRoutes.get("/:id", async (c) => {
  const dep = await deploySvc.getDeployment(c.req.param("id")!);
  if (!dep) return c.json({ error: "Not found" }, 404);
  return c.json(dep);
});

// --- List by run ---
deploymentRoutes.get("/by-run/:runId", async (c) => {
  const deps = await deploySvc.listDeploymentsByRun(c.req.param("runId")!);
  return c.json(deps);
});

// --- Start local static preview ---
deploymentRoutes.post("/preview", async (c) => {
  const body = await c.req.json<{ runId: string; rootPath: string }>();
  try {
    const { url, deploymentId } = await deploySvc.startLocalPreview(body.runId, body.rootPath);
    return c.json({ url, deploymentId }, 201);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// --- Create zip download ---
deploymentRoutes.post("/zip", async (c) => {
  const body = await c.req.json<{ runId: string; rootPath: string }>();
  try {
    const { downloadUrl, deploymentId } = await deploySvc.createZipDownload(body.runId, body.rootPath);
    return c.json({ downloadUrl, deploymentId }, 201);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// --- Download zip file ---
deploymentRoutes.get("/:id/download", async (c) => {
  const zipPath = deploySvc.getDownloadPath(c.req.param("id")!);
  if (!fs.existsSync(zipPath)) {
    return c.json({ error: "File not found" }, 404);
  }
  const content = fs.readFileSync(zipPath);
  return new Response(content, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="workspace-${c.req.param("id")!}.zip"`,
    },
  });
});

// --- Stop preview ---
deploymentRoutes.post("/:id/stop", async (c) => {
  deploySvc.stopPreview(c.req.param("id")!);
  return c.json({ ok: true });
});