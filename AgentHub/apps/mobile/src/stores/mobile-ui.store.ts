import { create } from "zustand";

export type PageName = "home" | "chat" | "artifact" | "approval" | "settings" | "offline";

export interface PageEntry {
  name: PageName;
  params?: Record<string, unknown>;
}

interface MobileUIState {
  stack: PageEntry[];
  isOnline: boolean;
  push: (name: PageName, params?: Record<string, unknown>) => void;
  pop: () => void;
  replace: (name: PageName, params?: Record<string, unknown>) => void;
  goHome: () => void;
  setOnline: (v: boolean) => void;
}

export const useMobileUIStore = create<MobileUIState>((set) => ({
  stack: [{ name: "home" }],
  isOnline: true,

  push: (name, params) =>
    set((s) => ({ stack: [...s.stack, { name, params }] })),

  pop: () =>
    set((s) => {
      if (s.stack.length <= 1) return s;
      return { stack: s.stack.slice(0, -1) };
    }),

  replace: (name, params) =>
    set((s) => {
      const next = [...s.stack];
      next[next.length - 1] = { name, params };
      return { stack: next };
    }),

  goHome: () => set({ stack: [{ name: "home" }] }),

  setOnline: (v) => set({ isOnline: v }),
}));
