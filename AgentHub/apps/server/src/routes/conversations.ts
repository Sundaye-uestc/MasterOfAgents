// ============================================================
// Conversation & Message REST routes
// ============================================================

import { Hono } from "hono";
import { ChatService } from "../services/chat.service.js";
import { getAgentRuntimeService } from "../services/agent-runtime.service.js";
import { OrchestratorService } from "../services/orchestrator.service.js";
import type { AgentConfig } from "@agenthub/shared";
import { broadcastToConversation, agentEventToWsEvent } from "../ws/gateway.js";

const chat = new ChatService();
const runtime = getAgentRuntimeService();

export const conversationRoutes = new Hono();

// --- List / Search conversations ---
conversationRoutes.get("/", async (c) => {
  const q = c.req.query("q");
  const list = await chat.listConversations(q ?? undefined);
  return c.json(list);
});

// --- Get agent mapping for all conversations ---
conversationRoutes.get("/agents-map", async (c) => {
  const map = await chat.getConversationAgentsMap();
  return c.json(map);
});

// --- Create conversation ---
conversationRoutes.post("/", async (c) => {
  const body = await c.req.json<{ title: string; type?: "direct" | "group"; agentId?: string }>();
  const conv = await chat.createConversation(body);
  return c.json(conv, 201);
});

// --- Get conversation's assigned agent ---
conversationRoutes.get("/:id/agent", async (c) => {
  const agentId = await chat.getConversationAgent(c.req.param("id")!);
  return c.json({ agentId });
});

// --- Get conversation ---
conversationRoutes.get("/:id", async (c) => {
  const conv = await chat.getConversation(c.req.param("id")!);
  if (!conv) return c.json({ error: "Not found" }, 404);
  return c.json(conv);
});

// --- Delete conversation ---
conversationRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id")!;
  const deleted = await chat.deleteConversation(id);
  if (!deleted) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

// --- Rename ---
conversationRoutes.patch("/:id/rename", async (c) => {
  const body = await c.req.json<{ title: string }>();
  const ok = await chat.renameConversation(c.req.param("id")!, body.title);
  if (!ok) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

// --- Pin ---
conversationRoutes.patch("/:id/pin", async (c) => {
  const body = await c.req.json<{ pinned: boolean }>();
  const ok = await chat.pinConversation(c.req.param("id")!, body.pinned);
  if (!ok) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

// --- Archive ---
conversationRoutes.patch("/:id/archive", async (c) => {
  await chat.archiveConversation(c.req.param("id")!);
  return c.json({ ok: true });
});

// --- Unarchive ---
conversationRoutes.patch("/:id/unarchive", async (c) => {
  await chat.unarchiveConversation(c.req.param("id")!);
  return c.json({ ok: true });
});

// --- List members ---
conversationRoutes.get("/:id/members", async (c) => {
  const members = await chat.getMembersForConversation(c.req.param("id")!);
  return c.json(members);
});

// --- Add member ---
conversationRoutes.post("/:id/members", async (c) => {
  const body = await c.req.json<{ agentId: string; role?: string }>();
  const member = await chat.addMember(c.req.param("id")!, body.agentId, body.role);
  return c.json(member, 201);
});

// --- Remove member ---
conversationRoutes.delete("/:id/members/:agentId", async (c) => {
  await chat.removeMember(c.req.param("id")!, c.req.param("agentId")!);
  return c.json({ ok: true });
});

// --- List messages ---
conversationRoutes.get("/:id/messages", async (c) => {
  const msgs = await chat.listMessages(c.req.param("id")!);
  return c.json(msgs);
});

// --- Pin message ---
conversationRoutes.patch("/messages/:id/pin", async (c) => {
  const body = await c.req.json<{ pinned: boolean }>();
  await chat.pinMessage(c.req.param("id")!, body.pinned);
  return c.json({ ok: true });
});

// --- Delete message ---
conversationRoutes.delete("/messages/:id", async (c) => {
  const ok = await chat.deleteMessage(c.req.param("id")!);
  if (!ok) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

// --- Send message (trigger agent) ---
conversationRoutes.post("/:id/messages", async (c) => {
  const body = await c.req.json<{
    content: string;
    replyToId?: string;
    agentId?: string;
    systemPrompt?: string;
  }>();
  const conversationId = c.req.param("id")!;

  // Get conversation info to decide direct vs orchestrated
  const conv = await chat.getConversation(conversationId);
  const members = await chat.getMembersForConversation(conversationId);

  // Persist user message
  const userMsg = await chat.createMessage({
    conversationId,
    role: "user",
    content: body.content,
    replyToId: body.replyToId,
  });

  const isGroupChat = conv?.type === "group" && members.length > 1;

  if (isGroupChat) {
    // --- Orchestrated run ---
    const agentConfigs: AgentConfig[] = members.map((m) => ({
      id: m.agentId,
      name: m.agentName,
      platform: "claude-code" as const,
      status: "online" as const,
      capabilities: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));

    const orchestrator = new OrchestratorService(chat);
    const { runId, plan } = await orchestrator.startOrchestratedRun({
      conversationId,
      triggerMessageId: userMsg.id,
      prompt: body.content,
      agentConfigs,
      systemPrompt: body.systemPrompt,
    });

    return c.json({ userMessage: userMsg, runId, plan, mode: "orchestrated" }, 201);
  }

  // --- Direct run (existing flow) ---

  // Build agent config
  const agentConfig: AgentConfig = {
    id: body.agentId ?? "default-claude",
    name: "Claude",
    platform: "claude-code",
    status: "online",
    capabilities: [{ label: "code-generation" }],
    systemPrompt: body.systemPrompt,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // Start run with streaming → WebSocket broadcast
  const { runId, agentMessageId } = await runtime.startDirectRun({
    conversationId,
    agentId: agentConfig.id,
    agentConfig,
    prompt: body.content,
    systemPrompt: body.systemPrompt,
    triggerMessageId: userMsg.id,
    chatService: chat,
    onEvent: (event, msgId) => {
      // Append text deltas to the agent message in DB (skip if aborted)
      if (event.type === "text_delta") {
        if (!runtime.isRunAborted(event.runId)) {
          chat.appendContent(msgId, event.delta);
        }
      }
      // Broadcast via WS
      const wsEvent = agentEventToWsEvent(event);
      if (wsEvent) {
        // Attach the agent message ID so client can associate deltas
        if (wsEvent.type === "message:delta") {
          (wsEvent as any).messageId = msgId;
        }
        broadcastToConversation(conversationId, wsEvent);
      }
      // Emit message:completed so client can finalize the streaming UI
      if (event.type === "run_completed" || event.type === "run_failed") {
        broadcastToConversation(conversationId, {
          type: "message:completed",
          messageId: msgId,
        });
      }
    },
  });

  return c.json({ userMessage: userMsg, runId, agentMessageId }, 201);
});
