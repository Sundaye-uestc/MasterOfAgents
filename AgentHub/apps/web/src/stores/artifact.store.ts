// ============================================================
// Artifact Store — Zustand store for artifacts and deployments
// ============================================================

import { create } from "zustand";
import type { ArtifactRow } from "@agenthub/shared";
import { listArtifactsByConversation, deployArtifact } from "../lib/api.js";

interface DeployState {
  id: string | null;
  artifactId: string | null;
  status: "pending" | "building" | "deployed" | "failed";
  url: string | null;
  target: string | null;
}

interface ArtifactStoreState {
  artifacts: ArtifactRow[];
  deployments: DeployState[];
  loading: boolean;

  load: (conversationId: string) => Promise<void>;
  deploy: (artifactId: string, target?: "local-static" | "zip") => Promise<void>;
  addDeployment: (dep: DeployState) => void;
  updateDeployment: (id: string, updates: Partial<DeployState>) => void;
}

export const useArtifactStore = create<ArtifactStoreState>((set, get) => ({
  artifacts: [],
  deployments: [],
  loading: false,

  load: async (conversationId) => {
    set({ loading: true });
    try {
      const arts = await listArtifactsByConversation(conversationId);
      set({ artifacts: arts, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  deploy: async (artifactId, target) => {
    const result = await deployArtifact(artifactId, target);
    set((s) => ({
      deployments: [...s.deployments, {
        id: `deploy-${Date.now()}`,
        artifactId,
        status: "deployed",
        url: result.previewUrl,
        target: target ?? "local-static",
      }],
    }));
  },

  addDeployment: (dep) => {
    set((s) => ({
      deployments: s.deployments.some((d) => d.id === dep.id)
        ? s.deployments
        : [...s.deployments, dep],
    }));
  },

  updateDeployment: (id, updates) => {
    set((s) => ({
      deployments: s.deployments.map((d) =>
        d.id === id ? { ...d, ...updates } : d
      ),
    }));
  },
}));