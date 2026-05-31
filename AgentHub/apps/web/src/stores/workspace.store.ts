// ============================================================
// Workspace Store — Zustand store for workspace files, snapshots, changes
// ============================================================

import { create } from "zustand";
import type { FileChangeRow } from "@agenthub/shared";
import {
  getWorkspace,
  createWorkspace,
  listSnapshots,
  listFiles,
  createSnapshot,
  listFileChangesByConversation,
} from "../lib/api.js";

interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

interface SnapshotItem {
  id: string;
  label: string | null;
  createdAt: string;
  runId: string | null;
}

interface WorkspaceStoreState {
  workspaceId: string | null;
  rootPath: string | null;
  files: FileNode[];
  snapshots: SnapshotItem[];
  fileChanges: FileChangeRow[];
  loading: boolean;

  load: (conversationId: string) => Promise<void>;
  addSnapshot: (label: string, runId: string, manifest: Record<string, unknown>) => Promise<void>;
  updateFileChange: (updated: FileChangeRow) => void;
}

export const useWorkspaceStore = create<WorkspaceStoreState>((set, get) => ({
  workspaceId: null,
  rootPath: null,
  files: [],
  snapshots: [],
  fileChanges: [],
  loading: false,

  load: async (conversationId) => {
    set({ loading: true });
    try {
      const [ws, changes] = await Promise.all([
        getWorkspace(conversationId),
        listFileChangesByConversation(conversationId),
      ]);

      let files: FileNode[] = [];
      let snapshots: SnapshotItem[] = [];

      if (ws) {
        set({ workspaceId: ws.id, rootPath: ws.rootPath });
        try {
          const snaps = await listSnapshots(ws.id);
          snapshots = snaps.map((s: any) => ({
            id: s.id,
            label: s.label,
            createdAt: s.createdAt,
            runId: s.runId,
          }));
        } catch { /* snapshot load failure is non-fatal */ }

        try {
          files = await listFiles(ws.id);
        } catch { /* file tree load failure is non-fatal */ }
      }

      set({ files, snapshots, fileChanges: changes, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  addSnapshot: async (label, runId, manifest) => {
    const wsId = get().workspaceId;
    if (!wsId) return;
    const snap = await createSnapshot(wsId, runId, label, manifest);
    set((s) => ({
      snapshots: [{
        id: (snap as any).id,
        label: (snap as any).label,
        createdAt: (snap as any).createdAt,
        runId: (snap as any).runId,
      }, ...s.snapshots],
    }));
  },

  updateFileChange: (updated) => {
    set((s) => ({
      fileChanges: s.fileChanges.map((c) => (c.id === updated.id ? updated : c)),
    }));
  },
}));