// ============================================================
// Workspace types — shared between server and web
// ============================================================

export interface WorkspaceRef {
  id: string;
  rootPath: string;
}

export interface FileEntry {
  hash: string;
  size: number;
}

export type Manifest = Record<string, FileEntry>;

export interface Snapshot {
  id: string;
  workspaceId: string;
  runId: string | null;
  label: string | null;
  manifest: Manifest | null;
  createdAt: string;
}

export interface FileChange {
  id: string;
  runId: string;
  taskId: string | null;
  path: string;
  changeType: "create" | "modify" | "delete";
  beforeHash: string | null;
  afterHash: string | null;
  diff: string | null;
  status: "pending" | "applied" | "reverted";
  createdAt: string;
}