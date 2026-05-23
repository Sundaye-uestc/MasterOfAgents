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

export function createConversation(title: string, type: "direct" | "group" = "direct", agentId?: string, agentIds?: string[]) {
  return request<ConversationRow>("/conversations", {
    method: "POST",
    body: JSON.stringify({ title, type, agentId, agentIds }),
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

export function deleteMessage(messageId: string) {
  return request<{ ok: boolean }>(`/conversations/messages/${messageId}`, { method: "DELETE" });
}

// --- Runs ---

export function getActiveRuns() {
  return request<unknown[]>("/runs");
}

export function stopRun(runId: string) {
  return request<{ ok: boolean }>(`/runs/${runId}/stop`, { method: "POST" });
}

// --- Agents ---

export function listAgents() {
  return request<AgentRow[]>("/agents");
}

export function createAgentFromDraft(draft: { name: string; platform?: string; capabilities?: string[]; systemPrompt?: string }) {
  return request<AgentRow>("/agents/from-draft", {
    method: "POST",
    body: JSON.stringify(draft),
  });
}

export function respondToPermission(runId: string, permissionId: string, approved: boolean) {
  return request<{ ok: boolean }>(`/runs/${runId}/permissions`, {
    method: "POST",
    body: JSON.stringify({ permissionId, approved }),
  });
}
