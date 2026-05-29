// ============================================================
// ArtifactService — artifact creation, preview, download
// ============================================================

import { getDb, schema } from "../db/index.js";
import { eq, desc } from "drizzle-orm";
import { newId, nowISO } from "../lib/ids.js";
import type { ArtifactRow } from "@agenthub/shared";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";

export class ArtifactService {
  async getArtifact(id: string): Promise<ArtifactRow | undefined> {
    return getDb()
      .select()
      .from(schema.artifacts)
      .where(eq(schema.artifacts.id, id))
      .get() as any;
  }

  async listArtifactsByRun(runId: string): Promise<ArtifactRow[]> {
    return getDb()
      .select()
      .from(schema.artifacts)
      .where(eq(schema.artifacts.runId, runId))
      .orderBy(desc(schema.artifacts.createdAt))
      .all() as any;
  }

  async listArtifactsByConversation(conversationId: string): Promise<ArtifactRow[]> {
    const db = getDb();
    const runRows = db
      .select({ id: schema.runs.id })
      .from(schema.runs)
      .where(eq(schema.runs.conversationId, conversationId))
      .all();

    const runIds = runRows.map((r: any) => r.id);
    if (runIds.length === 0) return [];

    const all: ArtifactRow[] = [];
    for (const runId of runIds) {
      const arts = await this.listArtifactsByRun(runId);
      all.push(...arts);
    }
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** Create an artifact from a file change or output file */
  async createArtifact(input: {
    runId: string;
    messageId?: string;
    type: "file" | "diff" | "webpage" | "archive";
    name: string;
    filePath?: string;
    mimeType?: string;
    size?: number;
    metadata?: Record<string, unknown>;
    rootPath?: string;
  }): Promise<ArtifactRow> {
    const db = getDb();
    const now = nowISO();
    const id = newId();

    let previewUrl: string | null = null;
    let resolvedPath: string | null = input.filePath ?? null;

    if (input.filePath && input.rootPath) {
      const fullPath = path.resolve(input.rootPath, input.filePath);
      if (fs.existsSync(fullPath)) {
        const stat = fs.statSync(fullPath);
        const size = input.size ?? stat.size;

        // Serve static files from a data/artifacts cache
        const cacheDir = path.resolve(process.cwd(), "data", "artifacts", id);
        fs.mkdirSync(cacheDir, { recursive: true });
        const destName = path.basename(input.filePath);
        fs.copyFileSync(fullPath, path.join(cacheDir, destName));
        previewUrl = `/artifacts/${id}/${destName}`;
        resolvedPath = `artifacts/${id}/${destName}`;

        input.size = size;
      }
    }

    const row: ArtifactRow = {
      id,
      runId: input.runId,
      messageId: input.messageId ?? null,
      type: input.type,
      name: input.name,
      path: resolvedPath,
      mimeType: input.mimeType ?? null,
      size: input.size ?? null,
      previewUrl,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
      createdAt: now,
    };

    db.insert(schema.artifacts).values({
      id: row.id,
      runId: row.runId,
      messageId: row.messageId,
      type: row.type,
      name: row.name,
      path: row.path,
      mimeType: row.mimeType,
      size: row.size,
      previewUrl: row.previewUrl,
      metadataJson: row.metadataJson,
      createdAt: row.createdAt,
    }).run();

    return row;
  }

  /** Create a diff artifact from file changes */
  async createDiffArtifact(runId: string, changes: Array<{ path: string; diff: string | null }>): Promise<ArtifactRow> {
    const combinedDiff = changes
      .filter((c) => c.diff)
      .map((c) => `## ${c.path}\n\n\`\`\`diff\n${c.diff}\n\`\`\``)
      .join("\n\n");

    const cacheDir = path.resolve(process.cwd(), "data", "artifacts", runId);
    fs.mkdirSync(cacheDir, { recursive: true });
    const diffPath = path.join(cacheDir, "changes.diff");
    fs.writeFileSync(diffPath, combinedDiff || "No changes detected");

    return this.createArtifact({
      runId,
      type: "diff",
      name: "File Changes",
      filePath: diffPath,
      mimeType: "text/x-diff",
      size: Buffer.byteLength(combinedDiff),
      metadata: { changeCount: changes.length },
    });
  }

  /** Get the physical file path for an artifact */
  getArtifactFilePath(artifact: ArtifactRow): string | null {
    if (!artifact.path) return null;
    return path.resolve(process.cwd(), "data", artifact.path);
  }
}