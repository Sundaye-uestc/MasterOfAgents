// ============================================================
// ChatService �?conversation & message management
// ============================================================

import { getDb, schema } from "../db/index.js";
import { eq, desc, like, and } from "drizzle-orm";
import { newId, nowISO } from "../lib/ids.js";
import type { ConversationRow, MessageRow } from "@agenthub/shared";
import { broadcastToConversation } from "../ws/gateway.js";
import * as fs from "node:fs";
import * as path from "node:path";

export class ChatService {
  // --- Conversations ---

  async listConversations(q?: string): Promise<ConversationRow[]> {
    const db = getDb();
    if (q) {
      return db
        .select()
        .from(schema.conversations)
        .where(like(schema.conversations.title, `%${q}%`))
        .orderBy(desc(schema.conversations.updatedAt))
        .all() as any;
    }
    return db
      .select()
      .from(schema.conversations)
      .orderBy(desc(schema.conversations.updatedAt))
      .all() as any;
  }

  /** Get agent info for all conversations (batch) */
  async getConversationAgentsMap(): Promise<Record<string, { agentId: string; agentName: string; adapterKind: string; avatar?: string | null }>> {
    const db = getDb();
    const members = db
      .select()
      .from(schema.conversationMembers)
      .leftJoin(schema.agents, eq(schema.conversationMembers.agentId, schema.agents.id))
      .all() as any[];
    const map: Record<string, any> = {};
    for (const row of members) {
      const convId = row.conversation_members?.conversationId ?? row.conversation_members?.conversation_id;
      const agent = row.agents;
      if (convId && agent) {
        map[convId] = {
          agentId: agent.id,
          agentName: agent.name,
          adapterKind: agent.adapterKind ?? agent.adapter_kind,
          avatar: agent.avatar ?? null,
        };
      }
    }
    return map;
  }

  async getConversation(id: string): Promise<ConversationRow | undefined> {
    const db = getDb();
    return db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.id, id))
      .get() as any;
  }

  async createConversation(input: { title: string; type?: "direct" | "group"; agentId?: string; agentIds?: string[] }): Promise<ConversationRow> {
    const db = getDb();
    const now = nowISO();
    const row: typeof schema.conversations.$inferInsert = {
      id: newId(),
      title: input.title,
      type: input.type ?? "direct",
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    db.insert(schema.conversations).values(row).run();

    // Collect agent IDs from both single and multi params
    const ids = input.agentIds ?? (input.agentId ? [input.agentId] : []);
    for (const agentId of ids) {
      db.insert(schema.conversationMembers).values({
        id: newId(),
        conversationId: row.id,
        agentId,
        role: "participant",
        autoReply: 1,
        joinedAt: now,
      }).run();
    }

    return row as unknown as ConversationRow;
  }

  /** Get the agent ID assigned to a conversation (first member) */
  // --- Member Management ---

  async addMember(conversationId: string, agentId: string, role: string = "participant"): Promise<any> {
    const db = getDb();
    const now = nowISO();
    const row = {
      id: newId(),
      conversationId,
      agentId,
      role,
      autoReply: 1,
      joinedAt: now,
    };
    db.insert(schema.conversationMembers).values(row).run();
    return row;
  }

  async removeMember(conversationId: string, agentId: string): Promise<void> {
    const db = getDb();
    db.delete(schema.conversationMembers)
      .where(
        and(
          eq(schema.conversationMembers.conversationId, conversationId),
          eq(schema.conversationMembers.agentId, agentId)
        )
      )
      .run();
  }

  async listMembers(conversationId: string): Promise<Array<{ member: any; agent: any }>> {
    const db = getDb();
    const rows = db
      .select()
      .from(schema.conversationMembers)
      .leftJoin(schema.agents, eq(schema.conversationMembers.agentId, schema.agents.id))
      .where(eq(schema.conversationMembers.conversationId, conversationId))
      .all() as any[];
    return rows.map((r: any) => ({
      member: r.conversation_members,
      agent: r.agents,
    }));
  }

  async getMembersForConversation(conversationId: string): Promise<Array<{ agentId: string; agentName: string; role: string; adapterKind: string; avatar?: string | null }>> {
    const members = await this.listMembers(conversationId);
    return members.map((m) => ({
      agentId: m.agent?.id ?? m.member?.agentId ?? m.member?.agent_id,
      agentName: m.agent?.name ?? "",
      role: m.member?.role ?? "participant",
      adapterKind: (m.agent?.adapterKind ?? m.agent?.adapter_kind ?? "custom") as string,
      avatar: m.agent?.avatar ?? null,
    }));
  }

  async getConversationAgent(conversationId: string): Promise<string | null> {
    const db = getDb();
    const member = db
      .select()
      .from(schema.conversationMembers)
      .where(eq(schema.conversationMembers.conversationId, conversationId))
      .limit(1)
      .get() as any;
    return member?.agentId ?? null;
  }

  async archiveConversation(id: string): Promise<void> {
    const db = getDb();
    db.update(schema.conversations)
      .set({ status: "archived", updatedAt: nowISO() } as any)
      .where(eq(schema.conversations.id, id))
      .run();
  }

  async renameConversation(id: string, title: string): Promise<boolean> {
    const db = getDb();
    const conv = await this.getConversation(id);
    if (!conv) return false;
    db.update(schema.conversations)
      .set({ title, updatedAt: nowISO() } as any)
      .where(eq(schema.conversations.id, id))
      .run();
    return true;
  }

  async pinConversation(id: string, pinned: boolean): Promise<boolean> {
    const db = getDb();
    const conv = await this.getConversation(id);
    if (!conv) return false;
    db.update(schema.conversations)
      .set({ pinnedAt: pinned ? nowISO() : null, updatedAt: nowISO() } as any)
      .where(eq(schema.conversations.id, id))
      .run();
    return true;
  }

  async unarchiveConversation(id: string): Promise<void> {
    const db = getDb();
    db.update(schema.conversations)
      .set({ status: "active", updatedAt: nowISO() } as any)
      .where(eq(schema.conversations.id, id))
      .run();
  }

  // --- Messages ---

  async listMessages(conversationId: string): Promise<MessageRow[]> {
    const db = getDb();
    return db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.conversationId, conversationId))
      .orderBy(schema.messages.createdAt)
      .all() as any;
  }

  async getMessage(id: string): Promise<MessageRow | undefined> {
    const db = getDb();
    return db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.id, id))
      .get() as any;
  }

  async createMessage(input: {
    conversationId: string;
    role: "user" | "agent" | "system";
    content: string;
    agentId?: string;
    replyToId?: string;
    runId?: string;
    status?: "sending" | "sent" | "streaming" | "error";
  }): Promise<MessageRow> {
    const db = getDb();
    const now = nowISO();
    const row: typeof schema.messages.$inferInsert = {
      id: newId(),
      conversationId: input.conversationId,
      role: input.role,
      content: input.content,
      agentId: input.agentId ?? null,
      replyToId: input.replyToId ?? null,
      runId: input.runId ?? null,
      status: input.status ?? "sent",
      createdAt: now,
      updatedAt: now,
    };
    db.insert(schema.messages).values(row).run();
    // Touch conversation timestamp
    db.update(schema.conversations)
      .set({ updatedAt: now } as any)
      .where(eq(schema.conversations.id, input.conversationId))
      .run();

    // Broadcast agent & system messages so they appear in real-time
    if (input.role === "agent" || input.role === "system") {
      broadcastToConversation(input.conversationId, {
        type: "message:created",
        message: row as unknown as MessageRow,
      } as any);
    }

    return row as unknown as MessageRow;
  }

  async updateMessageStatus(id: string, status: "sending" | "sent" | "streaming" | "error"): Promise<void> {
    const db = getDb();
    db.update(schema.messages)
      .set({ status, updatedAt: nowISO() } as any)
      .where(eq(schema.messages.id, id))
      .run();
  }

  async setContent(id: string, content: string): Promise<void> {
    const db = getDb();
    db.update(schema.messages)
      .set({ content, updatedAt: nowISO() } as any)
      .where(eq(schema.messages.id, id))
      .run();
  }

  async appendContent(id: string, delta: string): Promise<void> {
    const db = getDb();
    const msg = await this.getMessage(id);
    if (!msg) return;
    const newContent = (msg.content ?? "") + delta;
    db.update(schema.messages)
      .set({ content: newContent, updatedAt: nowISO() } as any)
      .where(eq(schema.messages.id, id))
      .run();
  }

  async pinMessage(id: string, pinned: boolean): Promise<void> {
    const db = getDb();
    const msg = await this.getMessage(id);
    if (!msg) return;
    const meta = msg.metadataJson ? JSON.parse(msg.metadataJson) : {};
    meta.pinned = pinned;
    db.update(schema.messages)
      .set({ metadataJson: JSON.stringify(meta), updatedAt: nowISO() } as any)
      .where(eq(schema.messages.id, id))
      .run();
  }

  async getPinnedMessages(conversationId: string): Promise<MessageRow[]> {
    const db = getDb();
    const all = await this.listMessages(conversationId);
    return all.filter((m) => {
      if (!m.metadataJson) return false;
      try {
        return JSON.parse(m.metadataJson).pinned === true;
      } catch {
        return false;
      }
    });
  }

  async deleteMessage(id: string): Promise<boolean> {
    const db = getDb();
    const msg = await this.getMessage(id);
    if (!msg) return false;
    db.delete(schema.messages).where(eq(schema.messages.id, id)).run();
    return true;
  }
  async deleteConversation(id: string): Promise<boolean> {
    const db = getDb();
    const conv = await this.getConversation(id);
    if (!conv) return false;

    // Find all runs for this conversation
    const runRows = db
      .select({ id: schema.runs.id })
      .from(schema.runs)
      .where(eq(schema.runs.conversationId, id))
      .all() as { id: string }[];
    const runIds = runRows.map((r) => r.id);

    // Delete dependent rows for each run
    for (const runId of runIds) {
      db.delete(schema.toolInvocations).where(eq(schema.toolInvocations.runId, runId)).run();
      db.delete(schema.fileChanges).where(eq(schema.fileChanges.runId, runId)).run();
      db.delete(schema.tasks).where(eq(schema.tasks.runId, runId)).run();
      db.delete(schema.artifacts).where(eq(schema.artifacts.runId, runId)).run();
      db.delete(schema.auditLogs).where(eq(schema.auditLogs.runId, runId)).run();
    }

    // Delete runs, messages, members, workspaces
    db.delete(schema.runs).where(eq(schema.runs.conversationId, id)).run();
    db.delete(schema.messages).where(eq(schema.messages.conversationId, id)).run();
    db.delete(schema.conversationMembers).where(eq(schema.conversationMembers.conversationId, id)).run();

    // Workspaces and snapshots — clean up DB rows AND on-disk files
    const wsRows = db
      .select({ id: schema.workspaces.id })
      .from(schema.workspaces)
      .where(eq(schema.workspaces.conversationId, id))
      .all() as { id: string }[];

    for (const ws of wsRows) {
      // Delete snapshot DB rows + on-disk snapshot directories
      const snapRows = db
        .select({ id: schema.workspaceSnapshots.id })
        .from(schema.workspaceSnapshots)
        .where(eq(schema.workspaceSnapshots.workspaceId, ws.id))
        .all() as { id: string }[];
      for (const snap of snapRows) {
        const snapDir = path.resolve(process.cwd(), "data", "snapshots", snap.id);
        if (fs.existsSync(snapDir)) {
          fs.rmSync(snapDir, { recursive: true, force: true });
        }
      }
      db.delete(schema.workspaceSnapshots).where(eq(schema.workspaceSnapshots.workspaceId, ws.id)).run();

      // Clean up on-disk workspace directory (data/workspaces/<id>/)
      const wsDir = path.resolve(process.cwd(), "data", "workspaces", ws.id);
      if (fs.existsSync(wsDir)) {
        fs.rmSync(wsDir, { recursive: true, force: true });
      }
    }
    db.delete(schema.workspaces).where(eq(schema.workspaces.conversationId, id)).run();

    // Finally delete the conversation
    db.delete(schema.conversations).where(eq(schema.conversations.id, id)).run();
    return true;
  }

  async getRecentMessages(conversationId: string, limit = 20): Promise<MessageRow[]> {
    const db = getDb();
    return db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.conversationId, conversationId))
      .orderBy(desc(schema.messages.createdAt))
      .limit(limit)
      .all()
      .reverse() as any;
  }

  /**
   * Build conversation history context for agent consumption.
   * Reads recent messages from DB and formats them as structured history.
   * Includes pinned messages first, then recent N messages.
   * Max 4000 chars to fit within context window limits.
   */
  async buildAgentContext(
    conversationId: string,
    maxMessages = 20,
    maxChars = 4000,
  ): Promise<Array<{ role: "user" | "agent" | "system"; content: string }>> {
    const db = getDb();
    const allMessages = db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.conversationId, conversationId))
      .orderBy(schema.messages.createdAt)
      .all() as any[];

    // Separate pinned messages
    const pinned: any[] = [];
    const normal: any[] = [];
    for (const msg of allMessages) {
      let isPinned = false;
      try {
        if (msg.metadataJson) {
          isPinned = JSON.parse(msg.metadataJson).pinned === true;
        }
      } catch { /* ignore parse errors */ }
      (isPinned ? pinned : normal).push(msg);
    }

    // Build result: pinned first, then recent normal messages
    const result: Array<{ role: "user" | "agent" | "system"; content: string }> = [];
    let totalChars = 0;

    const addMsg = (msg: any) => {
      // Skip orchestrator system messages (plan summaries, completion notices)
      // — they leak the full task plan to individual agents and cause scope creep.
      if (msg.role === "system" && msg.runId) return;
      const content = (msg.content ?? "").trim();
      if (!content) return;
      if (totalChars + content.length > maxChars) return;
      result.push({
        role: msg.role as "user" | "agent" | "system",
        content,
      });
      totalChars += content.length;
    };

    // Pinned messages first (max 5)
    for (const msg of pinned.slice(-5)) {
      addMsg(msg);
    }

    // Recent normal messages (max maxMessages, excluding the last user message being processed)
    const recentNormal = normal.slice(-maxMessages, -1); // exclude latest (current prompt)
    for (const msg of recentNormal) {
      addMsg(msg);
    }

    return result;
  }

  /** Find the user message that preceded a given agent message */
  async getPreviousUserMessage(agentMessageId: string): Promise<MessageRow | null> {
    const agentMsg = await this.getMessage(agentMessageId);
    if (!agentMsg || agentMsg.role !== "agent") return null;

    const allMessages = await this.listMessages(agentMsg.conversationId);
    const agentIdx = allMessages.findIndex((m) => m.id === agentMessageId);
    if (agentIdx === -1) return null;

    for (let i = agentIdx - 1; i >= 0; i--) {
      if (allMessages[i]!.role === "user") {
        return allMessages[i]!;
      }
    }
    return null;
  }

  // --- Intent Detection ---

  /** Detect "create agent" intent from user message */
  detectCreateAgentIntent(message: string): {
    name: string;
    platform: string;
    capabilities: string[];
    systemPrompt?: string;
  } | null {
    const patterns = [
      /(?:创建|新建|添加|create|add|new|做一个|写一个|帮我做)\s*(?:一个|个)?(?:(?:名叫|叫|名称是|名为|named)\s*\S+\s*(?:的|之)?)?\s*(?:agent|智能体|助手|机器人|codex|opencode)/i,
      /(?:create|make|build)\s+(?:a\s+)?(?:new\s+)?(?:agent|智能体|助手|机器人|bot)\s*(?:called|named|名叫|叫)?/i,
    ];

    const matched = patterns.some((p) => p.test(message));
    if (!matched) return null;

    // Extract name
    const nameMatch = message.match(/(?:名叫|叫|名称是|名为|called|named|name\s*(?:is|:)?)\s*["""]?(\S+)/i);
    const name = nameMatch?.[1]?.trim() ?? "Custom Agent";

    // Extract platform
    const platform = message.includes("codex") ? "codex"
      : message.includes("opencode") ? "opencode"
      : "claude-code";

    // Extract capabilities from keywords
    const capabilities: string[] = [];
    if (/(?:代码|code|编程|programming)/i.test(message)) capabilities.push("code-generation");
    if (/(?:调试|debug|bug|fix)/i.test(message)) capabilities.push("debugging");
    if (/(?:文件|file|read|write|读写)/i.test(message)) capabilities.push("file-management");
    if (/(?:测试|test)/i.test(message)) capabilities.push("testing");
    if (/(?:分析|analysis|review|审查)/i.test(message)) capabilities.push("analysis");
    if (capabilities.length === 0) capabilities.push("code-generation");

    // Extract system prompt
    const spMatch = message.match(/(?:system\s*prompt|系统提示|prompt|指令|要求)[：:]\s*(.+?)(?:$|(?:\n|。|\.\s))/i);
    const systemPrompt = spMatch?.[1]?.trim();

    return { name, platform, capabilities, systemPrompt };
  }
}
