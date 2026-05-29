// ============================================================
// UI Store — Zustand store for panels, dialogs, selection
// ============================================================

import { create } from "zustand";

type Panel = "workspace" | "artifacts" | "deployments";

interface DialogState {
  type: string | null;
  data: unknown;
}

interface UIStoreState {
  activePanel: Panel | null;
  dialog: DialogState;
  selectedMessageId: string | null;
  selectedArtifactId: string | null;

  togglePanel: (panel: Panel) => void;
  openPanel: (panel: Panel) => void;
  closePanel: () => void;
  openDialog: (type: string, data?: unknown) => void;
  closeDialog: () => void;
  selectMessage: (id: string | null) => void;
  selectArtifact: (id: string | null) => void;
}

export const useUIStore = create<UIStoreState>((set) => ({
  activePanel: null,
  dialog: { type: null, data: null },
  selectedMessageId: null,
  selectedArtifactId: null,

  togglePanel: (panel) => {
    set((s) => ({ activePanel: s.activePanel === panel ? null : panel }));
  },

  openPanel: (panel) => set({ activePanel: panel }),
  closePanel: () => set({ activePanel: null }),

  openDialog: (type, data) => set({ dialog: { type, data } }),
  closeDialog: () => set({ dialog: { type: null, data: null } }),

  selectMessage: (id) => set({ selectedMessageId: id }),
  selectArtifact: (id) => set({ selectedArtifactId: id }),
}));