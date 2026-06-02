// ============================================================
// WorkspaceService — workspace & snapshot management
// ============================================================

import { getDb, schema } from "../db/index.js";
import { eq, desc } from "drizzle-orm";
import { newId, nowISO } from "../lib/ids.js";
import type { WorkspaceRow, WorkspaceSnapshotRow, FileChangeRow } from "@agenthub/shared";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import * as diffLib from "diff";

// --- Manifest types ---

export interface FileEntry {
  hash: string;
  size: number;
}

export type Manifest = Record<string, FileEntry>;

export interface FileNode {
  name: string;
  path: string;       // relative path from rootPath
  type: "file" | "directory";
  children?: FileNode[];
}

export class WorkspaceService {
  // --- Workspaces ---

  async getWorkspace(id: string): Promise<WorkspaceRow | undefined> {
    return getDb()
      .select()
      .from(schema.workspaces)
      .where(eq(schema.workspaces.id, id))
      .get() as any;
  }

  async getWorkspaceByConversation(conversationId: string): Promise<WorkspaceRow | undefined> {
    return getDb()
      .select()
      .from(schema.workspaces)
      .where(eq(schema.workspaces.conversationId, conversationId))
      .get() as any;
  }

  async ensureWorkspace(conversationId: string): Promise<WorkspaceRow> {
    const existing = await this.getWorkspaceByConversation(conversationId);
    if (existing) return existing;

    const rootPath = path.resolve(process.cwd(), "..", "Test");
    fs.mkdirSync(rootPath, { recursive: true });
    return this.createWorkspace(conversationId, rootPath);
  }

  async createWorkspace(conversationId: string, rootPath: string): Promise<WorkspaceRow> {
    const db = getDb();
    const now = nowISO();
    const row = {
      id: newId(),
      conversationId,
      rootPath,
      status: "active",
      createdAt: now,
    };
    db.insert(schema.workspaces).values(row).run();
    return row as any;
  }

  async updateWorkspace(id: string, updates: { rootPath?: string }): Promise<WorkspaceRow | undefined> {
    const db = getDb();
    const ws = await this.getWorkspace(id);
    if (!ws) return undefined;

    if (updates.rootPath) {
      // Ensure the new directory exists
      fs.mkdirSync(updates.rootPath, { recursive: true });
      db.update(schema.workspaces)
        .set({ rootPath: updates.rootPath } as any)
        .where(eq(schema.workspaces.id, id))
        .run();
      ws.rootPath = updates.rootPath;
    }

    return ws;
  }

  async deleteWorkspace(id: string): Promise<boolean> {
    const db = getDb();
    const ws = await this.getWorkspace(id);
    if (!ws) return false;
    db.delete(schema.workspaceSnapshots).where(eq(schema.workspaceSnapshots.workspaceId, id)).run();
    db.delete(schema.workspaces).where(eq(schema.workspaces.id, id)).run();
    return true;
  }

  // --- Snapshots ---

  async listSnapshots(workspaceId: string): Promise<WorkspaceSnapshotRow[]> {
    return getDb()
      .select()
      .from(schema.workspaceSnapshots)
      .where(eq(schema.workspaceSnapshots.workspaceId, workspaceId))
      .orderBy(desc(schema.workspaceSnapshots.createdAt))
      .all() as any;
  }

  async getSnapshot(id: string): Promise<WorkspaceSnapshotRow | undefined> {
    return getDb()
      .select()
      .from(schema.workspaceSnapshots)
      .where(eq(schema.workspaceSnapshots.id, id))
      .get() as any;
  }

  async createSnapshot(
    workspaceId: string,
    runId: string,
    label: string,
    manifest: Record<string, unknown>
  ): Promise<WorkspaceSnapshotRow> {
    const db = getDb();
    const now = nowISO();
    const id = newId();
    const row = {
      id,
      workspaceId,
      runId,
      label,
      manifestJson: JSON.stringify(manifest),
      createdAt: now,
    };
    db.insert(schema.workspaceSnapshots).values(row).run();

    // Copy workspace files to snapshot directory for later diffing
    const ws = await this.getWorkspace(workspaceId);
    if (ws && fs.existsSync(ws.rootPath)) {
      const destDir = this._snapshotDir(id);
      fs.mkdirSync(destDir, { recursive: true });
      this._copyDir(ws.rootPath, destDir);
    }

    return row as any;
  }

  async deleteSnapshot(id: string): Promise<boolean> {
    const db = getDb();
    const snap = await this.getSnapshot(id);
    if (!snap) return false;
    db.delete(schema.workspaceSnapshots).where(eq(schema.workspaceSnapshots.id, id)).run();

    // Clean up snapshot file copies
    const snapDir = this._snapshotDir(id);
    if (fs.existsSync(snapDir)) {
      fs.rmSync(snapDir, { recursive: true, force: true });
    }

    return true;
  }

  /** Rollback workspace files to a snapshot state */
  async rollbackToSnapshot(snapshotId: string): Promise<boolean> {
    const snap = await this.getSnapshot(snapshotId);
    if (!snap) return false;

    const ws = await this.getWorkspace(snap.workspaceId);
    if (!ws || !fs.existsSync(ws.rootPath)) return false;

    const snapDir = this._snapshotDir(snapshotId);
    if (!fs.existsSync(snapDir)) return false;

    // Clear current workspace and copy snapshot files back
    fs.rmSync(ws.rootPath, { recursive: true, force: true });
    fs.mkdirSync(ws.rootPath, { recursive: true });
    this._copyDir(snapDir, ws.rootPath);

    return true;
  }

  // --- Manifest generation ---

  /** Walk a directory and generate a file manifest with SHA-256 hashes */
  generateManifest(rootPath: string): Manifest {
    const manifest: Manifest = {};
    if (!fs.existsSync(rootPath)) return manifest;
    this._walkDir(rootPath, rootPath, manifest);
    return manifest;
  }

  private _walkDir(basePath: string, currentPath: string, manifest: Manifest): void {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        // Skip hidden directories
        if (entry.name.startsWith(".")) continue;
        this._walkDir(basePath, fullPath, manifest);
      } else if (entry.isFile()) {
        const relativePath = path.relative(basePath, fullPath).replace(/\\/g, "/");
        const stat = fs.statSync(fullPath);
        const hash = this._fileHash(fullPath);
        manifest[relativePath] = { hash, size: stat.size };
      }
    }
  }

  private _fileHash(filePath: string): string {
    const content = fs.readFileSync(filePath);
    return crypto.createHash("sha256").update(content).digest("hex");
  }

  /** Try to read a text file from the workspace. Returns { text, isBinary } */
  readFileContent(rootPath: string, filePath: string): { text: string | null; isBinary: boolean; size: number } {
    const fullPath = path.resolve(rootPath, filePath);
    // Security: ensure path stays within rootPath
    if (!fullPath.startsWith(rootPath)) {
      return { text: null, isBinary: true, size: 0 };
    }
    if (!fs.existsSync(fullPath)) {
      return { text: null, isBinary: false, size: 0 };
    }
    const stat = fs.statSync(fullPath);
    // Reject files larger than 1MB
    if (stat.size > 1024 * 1024) {
      return { text: null, isBinary: true, size: stat.size };
    }
    try {
      const buf = fs.readFileSync(fullPath);
      // Check for null bytes (binary indicator)
      for (let i = 0; i < buf.length && i < 8192; i++) {
        if (buf[i] === 0) return { text: null, isBinary: true, size: stat.size };
      }
      return { text: buf.toString("utf-8"), isBinary: false, size: stat.size };
    } catch {
      return { text: null, isBinary: true, size: stat.size };
    }
  }

  /** Recursively build a FileNode tree from a directory on disk */
  buildFileTree(rootPath: string): FileNode[] {
    if (!fs.existsSync(rootPath)) return [];
    return this._buildTree(rootPath, rootPath);
  }

  private _buildTree(basePath: string, currentPath: string): FileNode[] {
    const result: FileNode[] = [];
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;

      const fullPath = path.join(currentPath, entry.name);
      const relativePath = path.relative(basePath, fullPath).replace(/\\/g, "/");

      if (entry.isDirectory()) {
        const children = this._buildTree(basePath, fullPath);
        result.push({
          name: entry.name,
          path: relativePath,
          type: "directory",
          children,
        });
      } else {
        result.push({
          name: entry.name,
          path: relativePath,
          type: "file",
        });
      }
    }

    // Directories first, then alphabetical within each group
    result.sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return result;
  }

  // --- Snapshot diffing ---

  /**
   * Compare two snapshots' manifests and create file_changes records.
   * Returns the created FileChange rows.
   */
  async diffSnapshots(beforeId: string, afterId: string): Promise<FileChangeRow[]> {
    const beforeSnap = await this.getSnapshot(beforeId);
    const afterSnap = await this.getSnapshot(afterId);
    if (!beforeSnap || !afterSnap) {
      console.error(`[workspace] diffSnapshots failed: before=${!!beforeSnap} after=${!!afterSnap}`);
      throw new Error("Snapshot not found");
    }

    const beforeManifest: Manifest = beforeSnap.manifestJson
      ? JSON.parse(beforeSnap.manifestJson)
      : {};
    const afterManifest: Manifest = afterSnap.manifestJson
      ? JSON.parse(afterSnap.manifestJson)
      : {};

    console.log(`[workspace] 📋 diffSnapshots: before has ${Object.keys(beforeManifest).length} files, after has ${Object.keys(afterManifest).length} files`);

    const runId = afterSnap.runId ?? beforeSnap.runId ?? newId();
    const db = getDb();
    const now = nowISO();
    const changes: FileChangeRow[] = [];

    const allPaths = new Set([...Object.keys(beforeManifest), ...Object.keys(afterManifest)]);

    for (const filePath of allPaths) {
      const before = beforeManifest[filePath];
      const after = afterManifest[filePath];

      let changeType: "create" | "modify" | "delete";
      let diff: string | null = null;

      if (!before && after) {
        changeType = "create";
        console.log(`[workspace]   ➕ create: ${filePath}`);
      } else if (before && !after) {
        changeType = "delete";
        console.log(`[workspace]   ➖ delete: ${filePath}`);
      } else if (before && after && before.hash !== after.hash) {
        changeType = "modify";
        diff = this._generateDiff(beforeId, filePath, before.hash, after.hash);
        console.log(`[workspace]   ✏️  modify: ${filePath} (${before.hash.slice(0,8)} → ${after.hash.slice(0,8)})`);
      } else {
        continue; // unchanged
      }

      const row: FileChangeRow = {
        id: newId(),
        runId,
        taskId: null,
        path: filePath,
        changeType,
        beforeHash: before?.hash ?? null,
        afterHash: after?.hash ?? null,
        diff,
        status: "pending",
        createdAt: now,
      };

      db.insert(schema.fileChanges).values({
        id: row.id,
        runId: row.runId,
        taskId: row.taskId,
        path: row.path,
        changeType: row.changeType,
        beforeHash: row.beforeHash,
        afterHash: row.afterHash,
        diff: row.diff,
        status: row.status,
        createdAt: row.createdAt,
      }).run();

      changes.push(row);
    }

    return changes;
  }

  /** Generate a real unified diff between before-snapshot and current workspace files */
  private _generateDiff(beforeSnapshotId: string, filePath: string, _beforeHash: string, _afterHash: string): string {
    const snapDir = this._snapshotDir(beforeSnapshotId);
    const beforeFile = path.join(snapDir, filePath);

    // Find the workspace root path by looking up the snapshot's workspace
    const afterFile = this._findWorkspaceFile(beforeSnapshotId, filePath);

    const beforeContent = fs.existsSync(beforeFile)
      ? fs.readFileSync(beforeFile, "utf-8")
      : "";
    const afterContent = afterFile && fs.existsSync(afterFile)
      ? fs.readFileSync(afterFile, "utf-8")
      : "";

    const patch = diffLib.createPatch(filePath, beforeContent, afterContent, "before", "after");
    return patch;
  }

  /** Resolve the snapshot storage directory */
  private _snapshotDir(snapshotId: string): string {
    return path.resolve(process.cwd(), "data", "snapshots", snapshotId);
  }

  /** Look up the workspace file path for a given snapshot */
  private _findWorkspaceFile(snapshotId: string, filePath: string): string | null {
    // Walk up: snapshot → workspace → rootPath
    const snap = this._getSnapshotSync(snapshotId);
    if (!snap) return null;
    const ws = this._getWorkspaceSync(snap.workspaceId);
    if (!ws) return null;
    return path.join(ws.rootPath, filePath);
  }

  /** Synchronously get a snapshot (for use in synchronous _generateDiff context) */
  private _getSnapshotSync(id: string): WorkspaceSnapshotRow | undefined {
    return getDb()
      .select()
      .from(schema.workspaceSnapshots)
      .where(eq(schema.workspaceSnapshots.id, id))
      .get() as any;
  }

  /** Synchronously get a workspace by ID */
  private _getWorkspaceSync(id: string): WorkspaceRow | undefined {
    return getDb()
      .select()
      .from(schema.workspaces)
      .where(eq(schema.workspaces.id, id))
      .get() as any;
  }

  /** Recursively copy a directory (skipping hidden files/dirs) */
  private _copyDir(src: string, dest: string): void {
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        fs.mkdirSync(destPath, { recursive: true });
        this._copyDir(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  // --- File Changes ---

  async getFileChange(id: string): Promise<FileChangeRow | undefined> {
    return getDb()
      .select()
      .from(schema.fileChanges)
      .where(eq(schema.fileChanges.id, id))
      .get() as any;
  }

  async listFileChangesByRun(runId: string): Promise<FileChangeRow[]> {
    return getDb()
      .select()
      .from(schema.fileChanges)
      .where(eq(schema.fileChanges.runId, runId))
      .orderBy(desc(schema.fileChanges.createdAt))
      .all() as any;
  }

  async listFileChangesByConversation(conversationId: string): Promise<FileChangeRow[]> {
    const db = getDb();
    // Join through runs to find file changes for a conversation
    // Using a simpler approach: get all runs for the conversation, then all file changes
    const runRows = db
      .select({ id: schema.runs.id })
      .from(schema.runs)
      .where(eq(schema.runs.conversationId, conversationId))
      .all();

    const runIds = runRows.map((r: any) => r.id);
    if (runIds.length === 0) return [];

    // SQLite doesn't support IN with drizzle-orm sql.js well, so we query per run
    const allChanges: FileChangeRow[] = [];
    for (const runId of runIds) {
      const changes = await this.listFileChangesByRun(runId);
      allChanges.push(...changes);
    }
    return allChanges.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** Mark a file change as applied */
  async applyFileChange(id: string): Promise<FileChangeRow | null> {
    const db = getDb();
    const fc = await this.getFileChange(id);
    if (!fc) return null;

    // Perform the actual file operation
    const ws = await this.getWorkspaceByRunId(fc.runId);
    if (ws && fc.changeType === "delete") {
      const filePath = path.resolve(ws.rootPath, fc.path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    db.update(schema.fileChanges)
      .set({ status: "applied" } as any)
      .where(eq(schema.fileChanges.id, id))
      .run();

    return { ...fc, status: "applied" };
  }

  /** Mark a file change as reverted */
  async revertFileChange(id: string): Promise<FileChangeRow | null> {
    const db = getDb();
    const fc = await this.getFileChange(id);
    if (!fc) return null;

    // For "create" type changes, revert = delete the created file
    const ws = await this.getWorkspaceByRunId(fc.runId);
    if (ws && fc.changeType === "create") {
      const filePath = path.resolve(ws.rootPath, fc.path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    db.update(schema.fileChanges)
      .set({ status: "reverted" } as any)
      .where(eq(schema.fileChanges.id, id))
      .run();

    return { ...fc, status: "reverted" };
  }

  /** Helper: get workspace for a given runId via the runs -> conversations -> workspaces chain */
  private async getWorkspaceByRunId(runId: string): Promise<WorkspaceRow | undefined> {
    const db = getDb();
    const run = db
      .select()
      .from(schema.runs)
      .where(eq(schema.runs.id, runId))
      .get() as any;
    if (!run) return undefined;
    return this.getWorkspaceByConversation(run.conversationId);
  }
}
