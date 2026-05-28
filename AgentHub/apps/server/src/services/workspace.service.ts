// ============================================================
// WorkspaceService — workspace & snapshot management
// ============================================================

import { getDb, schema } from "../db/index.js";
import { eq, desc } from "drizzle-orm";
import { newId, nowISO } from "../lib/ids.js";
import type { WorkspaceRow, WorkspaceSnapshotRow } from "@agenthub/shared";

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

  async deleteWorkspace(id: string): Promise<boolean> {
    const db = getDb();
    const ws = await this.getWorkspace(id);
    if (!ws) return false;
    // Cascade delete snapshots
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
    const row = {
      id: newId(),
      workspaceId,
      runId,
      label,
      manifestJson: JSON.stringify(manifest),
      createdAt: now,
    };
    db.insert(schema.workspaceSnapshots).values(row).run();
    return row as any;
  }

  async deleteSnapshot(id: string): Promise<boolean> {
    const db = getDb();
    const snap = await this.getSnapshot(id);
    if (!snap) return false;
    db.delete(schema.workspaceSnapshots).where(eq(schema.workspaceSnapshots.id, id)).run();
    return true;
  }
}
