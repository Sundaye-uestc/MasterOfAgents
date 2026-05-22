// ============================================================
// ChatService â€?conversation & message management
// ============================================================

import { getDb, schema } from "../db/index.js";
import { eq, desc, like, and } from "drizzle-orm";
import { newId, nowISO } from "../lib/ids.js";
import type { ConversationRow, MessageRow } from "@agenthub/shared";

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
  async getConversationAgentsMap(): Promise<Record<string, { agentId: string; agentName: string; adapterKind: string }>> {
    const db = getDb();
    const members = db
      .select()
      .from(schema.conversationMembers)
      .innerJoin(schema.agents, eq(schema.conversationMembers.agentId, schema.agents.id))
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

  async createConversation(input: { title: string; type?: "direct" | "group"; agentId?: string }): Promise<ConversationRow> {
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

    // If an agent is specified, add as conversation member
    if (input.agentId) {
      db.insert(schema.conversationMembers).values({
        id: newId(),
        conversationId: row.id,
        agentId: input.agentId,
        role: "participant",
        autoReply: 1,
        joinedAt: now,
      }).run();
    }

    return row as unknown as ConversationRow;
  }

  /** Get the agent ID assigned to a conversation (first member) */
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
      status: "sent",
      createdAt: now,
      updatedAt: now,
    };
    db.insert(schema.messages).values(row).run();
    // Touch conversation timestamp
    db.update(schema.conversations)
      .set({ updatedAt: now } as any)
      .where(eq(schema.conversations.id, input.conversationId))
      .run();
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

    // Workspaces and snapshots
    const wsRows = db
      .select({ id: schema.workspaces.id })
      .from(schema.workspaces)
      .where(eq(schema.workspaces.conversationId, id))
      .all() as { id: string }[];
    for (const ws of wsRows) {
      db.delete(schema.workspaceSnapshots).where(eq(schema.workspaceSnapshots.workspaceId, ws.id)).run();
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
}
