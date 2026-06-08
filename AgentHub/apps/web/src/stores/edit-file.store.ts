// Store for cross-component file editing — TextPreviewCard → CodeEditorPanel
import { create } from "zustand";

interface EditFileState {
  pendingFilePath: string | null;
  editFile: (path: string) => void;
  clear: () => void;
}

export const useEditFileStore = create<EditFileState>((set) => ({
  pendingFilePath: null,
  editFile: (path) => set({ pendingFilePath: path }),
  clear: () => set({ pendingFilePath: null }),
}));
