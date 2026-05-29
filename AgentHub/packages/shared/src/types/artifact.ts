// ============================================================
// Artifact types — shared between server and web
// ============================================================

export type ArtifactType = "file" | "diff" | "webpage" | "archive";

export type DeployStatus = "pending" | "building" | "deployed" | "failed";

export interface ArtifactRow {
  id: string;
  runId: string | null;
  messageId: string | null;
  type: ArtifactType;
  name: string;
  path: string | null;
  mimeType: string | null;
  size: number | null;
  previewUrl: string | null;
  metadataJson: string | null;
  createdAt: string;
}