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
  updateWorkspaceRootPath,
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
  activeConversationId: string | null;
  workspaceId: string | null;
  rootPath: string | null;
  files: FileNode[];
  snapshots: SnapshotItem[];
  fileChanges: FileChangeRow[];
  loading: boolean;

  load: (conversationId: string) => Promise<void>;
  addSnapshot: (label: string, runId: string, manifest: Record<string, unknown>) => Promise<void>;
  updateFileChange: (updated: FileChangeRow) => void;
  updateRootPath: (newPath: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceStoreState>((set, get) => ({
  activeConversationId: null,
  workspaceId: null,
  rootPath: null,
  files: [],
  snapshots: [],
  fileChanges: [],
  loading: false,

  load: async (conversationId) => {
    const prevConvId = get().activeConversationId;
    const isNewConversation = prevConvId !== conversationId;

    if (isNewConversation) {
      // Clear per-conversation state when switching conversations
      set({ activeConversationId: conversationId, loading: true, fileChanges: [], files: [], snapshots: [], workspaceId: null, rootPath: null });
    } else {
      set({ loading: true });
    }

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

      set((s) => {
        // Within the same conversation, merge WS-delivered changes with HTTP response.
        // Prevents WS-delivered changes from being overwritten by a slower HTTP load().
        if (s.activeConversationId !== conversationId) {
          // Conversation changed while request was in-flight — discard
          return {};
        }
        const existingIds = new Set(s.fileChanges.map((c) => c.id));
        const freshChanges = changes.filter((c: FileChangeRow) => !existingIds.has(c.id));
        const merged = freshChanges.length > 0
          ? [...freshChanges, ...s.fileChanges]
          : s.fileChanges;
        return { files, snapshots, fileChanges: merged, loading: false };
      });
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
    set((s) => {
      const idx = s.fileChanges.findIndex((c) => c.id === updated.id);
      if (idx === -1) {
        // New entry — prepend so it appears at the top
        return { fileChanges: [updated, ...s.fileChanges] };
      }
      // Existing entry — replace in-place
      const next = [...s.fileChanges];
      next[idx] = updated;
      return { fileChanges: next };
    });
  },

  updateRootPath: async (newPath) => {
    const wsId = get().workspaceId;
    if (!wsId) return;
    const updated = await updateWorkspaceRootPath(wsId, newPath);
    set({ rootPath: (updated as any).rootPath });
    // Reload file tree for the new path
    try {
      const files = await listFiles(wsId);
      set({ files });
    } catch {}
  },

  refresh: async () => {
    const wsId = get().workspaceId;
    if (!wsId) return;
    try {
      const [files, snaps] = await Promise.all([
        listFiles(wsId),
        listSnapshots(wsId),
      ]);
      set({
        files,
        snapshots: snaps.map((s: any) => ({
          id: s.id,
          label: s.label,
          createdAt: s.createdAt,
          runId: s.runId,
        })),
      });
    } catch {}
  },
}));