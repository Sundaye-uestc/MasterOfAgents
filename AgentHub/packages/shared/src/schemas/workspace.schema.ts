// ============================================================
// Zod schemas for Workspace
// ============================================================

import { z } from "zod";

export const FileEntrySchema = z.object({
  hash: z.string(),
  size: z.number(),
});

export const ManifestSchema = z.record(z.string(), FileEntrySchema);

export const WorkspaceRefSchema = z.object({
  id: z.string(),
  rootPath: z.string(),
});

export const SnapshotSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  runId: z.string().nullable(),
  label: z.string().nullable(),
  manifest: ManifestSchema.nullable(),
  createdAt: z.string(),
});

export const FileChangeSchema = z.object({
  id: z.string(),
  runId: z.string(),
  taskId: z.string().nullable(),
  path: z.string(),
  changeType: z.enum(["create", "modify", "delete"]),
  beforeHash: z.string().nullable(),
  afterHash: z.string().nullable(),
  diff: z.string().nullable(),
  status: z.enum(["pending", "applied", "reverted"]),
  createdAt: z.string(),
});

export const CreateSnapshotSchema = z.object({
  runId: z.string(),
  label: z.string(),
  manifest: z.record(z.string(), z.unknown()),
});