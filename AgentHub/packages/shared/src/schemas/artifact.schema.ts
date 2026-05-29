// ============================================================
// Zod schemas for Artifact
// ============================================================

import { z } from "zod";

export const ArtifactTypeSchema = z.enum(["file", "diff", "webpage", "archive"]);

export const DeployStatusSchema = z.enum(["pending", "building", "deployed", "failed"]);

export const ArtifactRowSchema = z.object({
  id: z.string(),
  runId: z.string().nullable(),
  messageId: z.string().nullable(),
  type: ArtifactTypeSchema,
  name: z.string().min(1),
  path: z.string().nullable(),
  mimeType: z.string().nullable(),
  size: z.number().nullable(),
  previewUrl: z.string().nullable(),
  metadataJson: z.string().nullable(),
  createdAt: z.string(),
});

export const CreateArtifactSchema = z.object({
  runId: z.string(),
  messageId: z.string().optional(),
  type: ArtifactTypeSchema,
  name: z.string().min(1),
  path: z.string().optional(),
  mimeType: z.string().optional(),
  size: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const DeployArtifactSchema = z.object({
  target: z.enum(["local-static", "zip"]).optional().default("local-static"),
});