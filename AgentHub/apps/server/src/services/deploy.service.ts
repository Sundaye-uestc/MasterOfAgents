// ============================================================
// DeployService — local preview, zip download, status tracking
// ============================================================

import { getDb, schema } from "../db/index.js";
import { eq, desc } from "drizzle-orm";
import { newId, nowISO } from "../lib/ids.js";
import * as fs from "node:fs";
import * as path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { broadcastToConversation } from "../ws/gateway.js";

interface DeployRow {
  id: string;
  artifactId: string | null;
  runId: string | null;
  status: "pending" | "building" | "deployed" | "failed";
  target: string | null;
  url: string | null;
  log: string | null;
  createdAt: string;
  completedAt: string | null;
}

export class DeployService {
  private activeServers = new Map<string, ChildProcess>();

  async getDeployment(id: string): Promise<DeployRow | undefined> {
    return getDb()
      .select()
      .from(schema.deployments)
      .where(eq(schema.deployments.id, id))
      .get() as any;
  }

  async listDeploymentsByRun(runId: string): Promise<DeployRow[]> {
    return getDb()
      .select()
      .from(schema.deployments)
      .where(eq(schema.deployments.runId, runId))
      .orderBy(desc(schema.deployments.createdAt))
      .all() as any;
  }

  /** Start a local static preview server */
  async startLocalPreview(runId: string, rootPath: string): Promise<{ url: string; deploymentId: string }> {
    const db = getDb();
    const now = nowISO();
    const deployId = newId();
    const port = 3100 + (Object.keys(this.activeServers).length % 100);

    // Create deployment record
    db.insert(schema.deployments).values({
      id: deployId,
      runId,
      status: "building",
      createdAt: now,
    }).run();

    // Start a simple static file server
    const server = spawn("node", ["-e", `
      const http = require('http');
      const fs = require('fs');
      const path = require('path');
      const root = ${JSON.stringify(rootPath)};
      const server = http.createServer((req, res) => {
        const filePath = path.join(root, req.url === '/' ? '/index.html' : req.url);
        try {
          const content = fs.readFileSync(filePath);
          const ext = path.extname(filePath);
          const mime = {
            '.html': 'text/html', '.js': 'application/javascript',
            '.css': 'text/css', '.json': 'application/json',
            '.png': 'image/png', '.jpg': 'image/jpeg',
            '.svg': 'image/svg+xml'
          }[ext] || 'application/octet-stream';
          res.writeHead(200, { 'Content-Type': mime, 'Access-Control-Allow-Origin': '*' });
          res.end(content);
        } catch {
          res.writeHead(404);
          res.end('Not found');
        }
      });
      server.listen(${port}, () => console.log('ready'));
    `], { detached: false });

    const url = `http://localhost:${port}`;
    this.activeServers.set(deployId, server);

    // Wait for server to be ready
    await new Promise<void>((resolve) => {
      server.stdout?.on("data", (data: Buffer) => {
        if (data.toString().includes("ready")) resolve();
      });
      setTimeout(resolve, 1500);
    });

    // Update deployment status
    db.update(schema.deployments)
      .set({ status: "deployed", url, completedAt: nowISO(), log: JSON.stringify({ port }) } as any)
      .where(eq(schema.deployments.id, deployId))
      .run();

    return { url, deploymentId: deployId };
  }

  /** Create a zip archive of workspace files */
  async createZipDownload(runId: string, rootPath: string): Promise<{ downloadUrl: string; deploymentId: string }> {
    const db = getDb();
    const now = nowISO();
    const deployId = newId();

    db.insert(schema.deployments).values({
      id: deployId,
      runId,
      status: "building",
      createdAt: now,
    }).run();

    // Create zip archive using simple archive (no external dependency for MVP)
    const zipDir = path.resolve(process.cwd(), "data", "downloads");
    fs.mkdirSync(zipDir, { recursive: true });
    const zipPath = path.join(zipDir, `${deployId}.zip`);

    // Use a simple tar-like approach: list all files and create index
    const files = this._walkDir(rootPath);
    const archive = files.map((f) => {
      const content = fs.readFileSync(path.join(rootPath, f), "utf-8");
      return { path: f, content };
    });

    fs.writeFileSync(zipPath, JSON.stringify(archive));
    const downloadUrl = `/api/deployments/${deployId}/download`;

    db.update(schema.deployments)
      .set({ status: "deployed", url: downloadUrl, completedAt: nowISO(), log: JSON.stringify({ fileCount: files.length, zipPath }) } as any)
      .where(eq(schema.deployments.id, deployId))
      .run();

    return { downloadUrl, deploymentId: deployId };
  }

  private _walkDir(root: string): string[] {
    const results: string[] = [];
    const entries = fs.readdirSync(root, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory() && !e.name.startsWith(".")) {
        results.push(...this._walkDir(path.join(root, e.name)).map((f) => path.join(e.name, f).replace(/\\/g, "/")));
      } else if (e.isFile()) {
        results.push(e.name);
      }
    }
    return results;
  }

  /** Get the download file path for a zip deployment */
  getDownloadPath(deployId: string): string {
    return path.resolve(process.cwd(), "data", "downloads", `${deployId}.zip`);
  }

  stopPreview(deployId: string): void {
    const server = this.activeServers.get(deployId);
    if (server) {
      server.kill();
      this.activeServers.delete(deployId);
    }
  }

  dispose(): void {
    for (const [id, server] of this.activeServers) {
      server.kill();
    }
    this.activeServers.clear();
  }
}