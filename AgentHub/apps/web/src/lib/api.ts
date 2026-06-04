// ============================================================
// REST API client for AgentHub
// ============================================================

import type { ConversationRow, MessageRow, AgentRow } from "@agenthub/shared";

const BASE = "/api";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// --- Conversations ---

export function listConversations(q?: string) {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  return request<ConversationRow[]>(`/conversations${qs}`);
}

export function createConversation(title: string, type: "direct" | "group" = "direct", agentId?: string, agentIds?: string[], rootPath?: string) {
  return request<ConversationRow>("/conversations", {
    method: "POST",
    body: JSON.stringify({ title, type, agentId, agentIds, rootPath }),
  });
}

export function listMembers(conversationId: string) {
  return request<Array<{ agentId: string; agentName: string; role: string; adapterKind: string }>>(`/conversations/${conversationId}/members`);
}

export function addMember(conversationId: string, agentId: string, role?: string) {
  return request<unknown>(`/conversations/${conversationId}/members`, {
    method: "POST",
    body: JSON.stringify({ agentId, role }),
  });
}

export function removeMember(conversationId: string, agentId: string) {
  return request<{ ok: boolean }>(`/conversations/${conversationId}/members/${agentId}`, { method: "DELETE" });
}

export function getConversationAgent(conversationId: string) {
  return request<{ agentId: string | null }>(`/conversations/${conversationId}/agent`);
}

export function getConversationAgentsMap() {
  return request<Record<string, { agentId: string; agentName: string; adapterKind: string }>>("/conversations/agents-map");
}

export function getConversation(id: string) {
  return request<ConversationRow>(`/conversations/${id}`);
}

export function deleteConversation(id: string) {
  return request<{ ok: boolean }>(`/conversations/${id}`, { method: "DELETE" });
}

export function renameConversation(id: string, title: string) {
  return request<{ ok: boolean }>(`/conversations/${id}/rename`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

export function pinConversation(id: string, pinned: boolean) {
  return request<{ ok: boolean }>(`/conversations/${id}/pin`, {
    method: "PATCH",
    body: JSON.stringify({ pinned }),
  });
}

export function archiveConversation(id: string) {
  return request<{ ok: boolean }>(`/conversations/${id}/archive`, { method: "PATCH" });
}

export function unarchiveConversation(id: string) {
  return request<{ ok: boolean }>(`/conversations/${id}/unarchive`, { method: "PATCH" });
}

// --- Messages ---

export function listMessages(conversationId: string) {
  return request<MessageRow[]>(`/conversations/${conversationId}/messages`);
}

export function sendMessage(conversationId: string, content: string, replyToId?: string, agentId?: string) {
  return request<{
    userMessage: MessageRow;
    runId: string;
    agentMessageId: string;
    mode?: "orchestrated";
    plan?: unknown;
  }>(
    `/conversations/${conversationId}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ content, replyToId, agentId }),
    }
  );
}

export function pinMessage(messageId: string, pinned: boolean) {
  return request<{ ok: boolean }>(`/conversations/messages/${messageId}/pin`, {
    method: "PATCH",
    body: JSON.stringify({ pinned }),
  });
}

export function getPinnedMessages(conversationId: string) {
  return request<MessageRow[]>(`/conversations/${conversationId}/pinned-messages`);
}

export function deleteMessage(messageId: string) {
  return request<{ ok: boolean }>(`/conversations/messages/${messageId}`, { method: "DELETE" });
}

export function retryMessage(messageId: string) {
  return request<{ runId: string; agentMessageId: string }>(
    `/conversations/messages/${messageId}/retry`,
    { method: "POST" }
  );
}

// --- Runs ---

export function getActiveRuns() {
  return request<unknown[]>("/runs");
}

export function stopRun(runId: string) {
  return request<{ ok: boolean }>(`/runs/${runId}/stop`, { method: "POST" });
}

import type { ParsedAgentIntent, PolishPromptResponse } from "@agenthub/shared";

// --- Agents ---

export function listAgents() {
  return request<AgentRow[]>("/agents");
}

export function getAgent(id: string) {
  return request<AgentRow>(`/agents/${id}`);
}

export function createAgentFromDraft(draft: {
  name: string;
  platform?: string;
  capabilities?: string[];
  systemPrompt?: string;
  toolSetIds?: string[];
}) {
  return request<AgentRow>("/agents/from-draft", {
    method: "POST",
    body: JSON.stringify(draft),
  });
}

export function updateAgent(
  id: string,
  data: {
    name?: string;
    enabled?: boolean;
    systemPrompt?: string;
    capabilities?: string[];
    toolSetIds?: string[];
    avatar?: string;
    status?: string;
  }
) {
  return request<AgentRow>(`/agents/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteAgent(id: string) {
  return request<{ ok: boolean }>(`/agents/${id}`, { method: "DELETE" });
}

// --- Agent Builder ---

export function parseCreationIntent(description: string) {
  return request<ParsedAgentIntent>("/agents/parse-intent", {
    method: "POST",
    body: JSON.stringify({ description }),
  });
}

export function polishSystemPrompt(draft: string) {
  return request<PolishPromptResponse>("/agents/polish-prompt", {
    method: "POST",
    body: JSON.stringify({ draft }),
  });
}

export function respondToPermission(runId: string, permissionId: string, approved: boolean) {
  return request<{ ok: boolean }>(`/runs/${runId}/permissions`, {
    method: "POST",
    body: JSON.stringify({ permissionId, approved }),
  });
}

// --- Workspaces ---

export function getWorkspace(conversationId: string) {
  return request<import("@agenthub/shared").WorkspaceRow | null>(`/workspaces?conversationId=${encodeURIComponent(conversationId)}`);
}

export function createWorkspace(conversationId: string, rootPath: string) {
  return request<import("@agenthub/shared").WorkspaceRow>("/workspaces", {
    method: "POST",
    body: JSON.stringify({ conversationId, rootPath }),
  });
}

export function deleteWorkspace(id: string) {
  return request<{ ok: boolean }>(`/workspaces/${id}`, { method: "DELETE" });
}

export function listSnapshots(workspaceId: string) {
  return request<import("@agenthub/shared").WorkspaceSnapshotRow[]>(`/workspaces/${workspaceId}/snapshots`);
}

interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

export type { FileNode };

export function listFiles(workspaceId: string) {
  return request<FileNode[]>(`/workspaces/${workspaceId}/files`);
}

export function browseDirectory(targetPath: string) {
  return request<FileNode[]>(`/workspaces/browse?path=${encodeURIComponent(targetPath)}`);
}

export function updateWorkspaceRootPath(workspaceId: string, rootPath: string) {
  return request<import("@agenthub/shared").WorkspaceRow>(`/workspaces/${workspaceId}`, {
    method: "PATCH",
    body: JSON.stringify({ rootPath }),
  });
}

export function createSnapshot(workspaceId: string, runId: string, label: string, manifest: Record<string, unknown>) {
  return request<import("@agenthub/shared").WorkspaceSnapshotRow>(`/workspaces/${workspaceId}/snapshots`, {
    method: "POST",
    body: JSON.stringify({ runId, label, manifest }),
  });
}

export function deleteSnapshot(workspaceId: string, snapshotId: string) {
  return request<{ ok: boolean }>(`/workspaces/${workspaceId}/snapshots/${snapshotId}`, { method: "DELETE" });
}

export function rollbackSnapshot(workspaceId: string, snapshotId: string) {
  return request<{ ok: boolean }>(`/workspaces/${workspaceId}/snapshots/${snapshotId}/rollback`, { method: "POST" });
}

export function readWorkspaceFile(workspaceId: string, filePath: string) {
  return request<{ text: string | null; isBinary: boolean; size: number }>(
    `/workspaces/${workspaceId}/file-content?path=${encodeURIComponent(filePath)}`
  );
}

// --- File Changes ---

export function getFileChange(id: string) {
  return request<import("@agenthub/shared").FileChangeRow>(`/file-changes/${id}`);
}

export function listFileChangesByRun(runId: string) {
  return request<import("@agenthub/shared").FileChangeRow[]>(`/file-changes/by-run/${runId}`);
}

export function listFileChangesByConversation(conversationId: string) {
  return request<import("@agenthub/shared").FileChangeRow[]>(`/file-changes/by-conversation/${conversationId}`);
}

export function applyFileChange(id: string) {
  return request<import("@agenthub/shared").FileChangeRow>(`/file-changes/${id}/apply`, { method: "POST" });
}

export function revertFileChange(id: string) {
  return request<import("@agenthub/shared").FileChangeRow>(`/file-changes/${id}/revert`, { method: "POST" });
}

// --- Artifacts ---

export function getArtifact(id: string) {
  return request<import("@agenthub/shared").ArtifactRow>(`/artifacts/${id}`);
}

export function listArtifactsByRun(runId: string) {
  return request<import("@agenthub/shared").ArtifactRow[]>(`/artifacts/by-run/${runId}`);
}

export function listArtifactsByConversation(conversationId: string) {
  return request<import("@agenthub/shared").ArtifactRow[]>(`/artifacts/by-conversation/${conversationId}`);
}

export function deployArtifact(id: string, target?: "local-static" | "zip") {
  return request<{ ok: boolean; previewUrl: string | null }>(`/artifacts/${id}/deploy`, {
    method: "POST",
    body: JSON.stringify({ target }),
  });
}
