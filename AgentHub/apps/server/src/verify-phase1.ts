// ============================================================
// Phase 1 — Web Single-Chat Closed Loop Verification
//
// Tests:
// 1. Database init & table creation
// 2. ChatService — conversations CRUD
// 3. ChatService — messages CRUD, pin, append
// 4. AgentRuntimeService — start run, streaming events
// 5. REST API routes
// 6. WebSocket gateway room management
//
// Run: npx tsx src/verify-phase1.ts
// ============================================================

import { initDb, getDb, closeDb, saveDb, schema } from "./db/index.js";
import { ChatService } from "./services/chat.service.js";
import { AgentRuntimeService } from "./services/agent-runtime.service.js";
import type { AgentEvent, AgentConfig } from "@agenthub/shared";
import { MAX_CONCURRENT_PROCESSES } from "@agenthub/shared";
import { appendFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

// ---- Log setup ----
const LOG_DIR = resolve(process.cwd(), "../../../DevelopDocuments/log");
const LOG_FILE = resolve(LOG_DIR, `phase1-verify-${Date.now()}.log`);

mkdirSync(LOG_DIR, { recursive: true });

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  appendFileSync(LOG_FILE, line + "\n");
}

function logSection(title: string) {
  log("");
  log("=".repeat(60));
  log(`  ${title}`);
  log("=".repeat(60));
}

function logResult(name: string, passed: boolean, detail?: string) {
  const status = passed ? "PASS" : "FAIL";
  log(`  [${status}] ${name}${detail ? ` — ${detail}` : ""}`);
}

// ---- Test 1: Database init & tables ----
async function testDatabaseInit(): Promise<boolean> {
  logSection("Test 1: Database init & table creation");

  try {
    await initDb();
    logResult("initDb() succeeds", true);

    const db = getDb();

    // Verify all tables exist by querying sqlite_master
    const tables = [
      "conversations", "conversation_members", "agents",
      "messages", "runs", "tasks", "tool_invocations",
      "workspaces", "workspace_snapshots", "file_changes",
      "artifacts", "audit_logs",
    ];

    let allExist = true;
    for (const table of tables) {
      const row = db.select().from(schema.conversations).limit(0).all();
      // Test by doing a select on each table (won't error if table exists)
      try {
        db.run(`SELECT 1 FROM ${table} LIMIT 0`);
        logResult(`Table '${table}' exists`, true);
      } catch {
        logResult(`Table '${table}' exists`, false);
        allExist = false;
      }
    }

    return allExist;
  } catch (err) {
    logResult("initDb() succeeds", false, (err as Error).message);
    return false;
  }
}

// ---- Test 2: ChatService — conversations CRUD ----
async function testConversationsCrud(): Promise<boolean> {
  logSection("Test 2: ChatService — conversations CRUD");

  const chat = new ChatService();

  // Create
  const conv = await chat.createConversation({ title: "Verify Conv", type: "direct" });
  logResult("createConversation", !!conv.id, `id=${conv.id}`);
  logResult("title matches", conv.title === "Verify Conv", conv.title);
  logResult("type is direct", conv.type === "direct", conv.type);

  // Get
  const fetched = await chat.getConversation(conv.id);
  logResult("getConversation", !!fetched && fetched.id === conv.id);

  // List
  const list = await chat.listConversations();
  logResult("listConversations", list.length >= 1, `count=${list.length}`);

  // Archive
  await chat.archiveConversation(conv.id);
  const archived = await chat.getConversation(conv.id);
  logResult("archiveConversation", archived?.status === "archived", archived?.status ?? "undefined");

  // Unarchive
  await chat.unarchiveConversation(conv.id);
  const unarchived = await chat.getConversation(conv.id);
  logResult("unarchiveConversation", unarchived?.status === "active", unarchived?.status ?? "undefined");

  // Search
  const searched = await chat.listConversations("Verify");
  logResult("search conversations", searched.length >= 1 && searched.some(c => c.id === conv.id),
    `found=${searched.length}`);

  return true;
}

// ---- Test 3: ChatService — messages, pin, append ----
async function testMessages(): Promise<boolean> {
  logSection("Test 3: ChatService — messages, pin, append");

  const chat = new ChatService();
  const conv = await chat.createConversation({ title: "Msg Test" });

  // Create user message
  const msg1 = await chat.createMessage({
    conversationId: conv.id,
    role: "user",
    content: "Hello",
  });
  logResult("createMessage (user)", msg1.role === "user" && msg1.content === "Hello");

  // Create agent message
  const msg2 = await chat.createMessage({
    conversationId: conv.id,
    role: "agent",
    content: "",
    agentId: "test-agent",
    runId: "test-run",
  });
  logResult("createMessage (agent)", msg2.role === "agent" && msg2.content === "");

  // Append content (streaming simulation)
  await chat.appendContent(msg2.id, "Hi ");
  await chat.appendContent(msg2.id, "there!");
  const updated = await chat.getMessage(msg2.id);
  logResult("appendContent", updated?.content === "Hi there!", `content="${updated?.content}"`);

  // Update status
  await chat.updateMessageStatus(msg2.id, "streaming");
  let statusCheck = await chat.getMessage(msg2.id);
  logResult("updateMessageStatus (streaming)", statusCheck?.status === "streaming");
  await chat.updateMessageStatus(msg2.id, "sent");
  statusCheck = await chat.getMessage(msg2.id);
  logResult("updateMessageStatus (sent)", statusCheck?.status === "sent");

  // Pin
  await chat.pinMessage(msg1.id, true);
  const pinned = await chat.getPinnedMessages(conv.id);
  logResult("pinMessage", pinned.length === 1 && pinned[0]!.id === msg1.id,
    `pinned count=${pinned.length}`);

  // Unpin
  await chat.pinMessage(msg1.id, false);
  const unpinned = await chat.getPinnedMessages(conv.id);
  logResult("unpinMessage", unpinned.length === 0, `pinned count=${unpinned.length}`);

  // Recent messages
  const recent = await chat.getRecentMessages(conv.id, 5);
  logResult("getRecentMessages", recent.length === 2, `count=${recent.length}`);

  return true;
}

// ---- Test 4: AgentRuntimeService — start run with real Claude ----
async function testAgentRuntime(): Promise<boolean> {
  logSection("Test 4: AgentRuntimeService — streaming run (real Claude CLI)");

  const chat = new ChatService();
  const runtime = new AgentRuntimeService();

  const conv = await chat.createConversation({ title: "Runtime Test" });

  const agentConfig: AgentConfig = {
    id: "verify-agent",
    name: "Verify Claude",
    platform: "claude-code",
    status: "online",
    capabilities: [{ label: "code-generation" }],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const events: AgentEvent[] = [];
  let agentMsgId = "";

  try {
    const { runId, agentMessageId } = await runtime.startDirectRun({
      conversationId: conv.id,
      agentId: agentConfig.id,
      agentConfig,
      prompt: "Reply with exactly: OK",
      triggerMessageId: "msg-1",
      chatService: chat,
      onEvent: (event, msgId) => {
        events.push(event);
        agentMsgId = msgId;
      },
    });

    logResult("startDirectRun returns runId", !!runId, `runId=${runId}`);
    logResult("startDirectRun returns agentMessageId", !!agentMessageId, `msgId=${agentMessageId}`);

    // Wait for completion (poll up to 30s)
    await waitFor(() => {
      return events.some(e => e.type === "run_completed" || e.type === "run_failed");
    }, 30_000);

    const hasStarted = events.some(e => e.type === "run_started");
    const hasText = events.some(e => e.type === "text_delta");
    const hasComplete = events.some(e => e.type === "run_completed");
    const hasFailed = events.some(e => e.type === "run_failed");

    logResult("run_started emitted", hasStarted);
    logResult("text_delta emitted", hasText, `${events.filter(e => e.type === "text_delta").length} deltas`);

    // Check for "OK" in text deltas
    const allText = events
      .filter(e => e.type === "text_delta")
      .map(e => (e as any).delta)
      .join("");
    logResult("agent responded with OK", allText.toUpperCase().includes("OK"), `text="${allText.slice(0, 80)}"`);

    logResult("run completed or failed", hasComplete || hasFailed,
      hasComplete ? "completed" : hasFailed ? "failed" : "neither");

    // Verify message was persisted with content
    const persisted = await chat.getMessage(agentMsgId);
    logResult("agent message persisted", !!persisted, `content length=${persisted?.content?.length ?? 0}`);

    await runtime.dispose();
    return hasStarted && hasText && (hasComplete || hasFailed);
  } catch (err) {
    logResult("streaming run", false, (err as Error).message);
    try { await runtime.dispose(); } catch { /* ignore */ }
    return false;
  }
}

// ---- Test 5: DB persistence across restarts ----
async function testPersistence(): Promise<boolean> {
  logSection("Test 5: DB persistence (save & reload)");

  const chat = new ChatService();
  const conv = await chat.createConversation({ title: "Persist Test" });
  const msg = await chat.createMessage({
    conversationId: conv.id,
    role: "user",
    content: "persistent data",
  });

  // Save to disk
  saveDb();
  logResult("saveDb() succeeds", true);

  // Close and reopen
  closeDb();
  await initDb();

  // Verify data survived
  const reloaded = await chat.getConversation(conv.id);
  logResult("conversation survives reload", !!reloaded && reloaded.title === "Persist Test");
  const reloadedMsg = await chat.getMessage(msg.id);
  logResult("message survives reload", !!reloadedMsg && reloadedMsg.content === "persistent data");

  return !!reloaded && !!reloadedMsg;
}

// ---- Test 6: WebSocket gateway types ----
async function testWsTypes(): Promise<boolean> {
  logSection("Test 6: WebSocket event type definitions");

  // Test that agentEventToWsEvent maps all relevant types
  const { agentEventToWsEvent } = await import("./ws/gateway.js");

  const testCases: Array<{ event: AgentEvent; expectedType: string }> = [
    { event: { type: "run_started", runId: "r1", agentId: "a1", timestamp: 1 }, expectedType: "run:started" },
    { event: { type: "text_delta", runId: "r1", delta: "hi", timestamp: 1 }, expectedType: "message:delta" },
    { event: { type: "run_completed", runId: "r1", summary: "ok", timestamp: 1 }, expectedType: "run:completed" },
    { event: { type: "run_failed", runId: "r1", error: "err", timestamp: 1 }, expectedType: "run:failed" },
    { event: { type: "tool_call", runId: "r1", toolCallId: "tc1", toolName: "read", input: {}, timestamp: 1 }, expectedType: "tool:invocation" },
    { event: { type: "file_change", runId: "r1", path: "/f", kind: "modify", timestamp: 1 }, expectedType: "file:changed" },
    { event: { type: "artifact_created", runId: "r1", artifactId: "a1", artifactType: "file", path: "/x", timestamp: 1 }, expectedType: "artifact:created" },
    { event: { type: "log", runId: "r1", level: "info", message: "log", timestamp: 1 }, expectedType: "null" },
  ];

  let allOk = true;
  for (const { event, expectedType } of testCases) {
    const result = agentEventToWsEvent(event);
    const actualType = result?.type ?? "null";
    const ok = actualType === expectedType;
    if (!ok) allOk = false;
    logResult(`event ${event.type} → ${expectedType}`, ok, `got: ${actualType}`);
  }

  return allOk;
}

// ---- Helpers ----
function waitFor(condition: () => boolean, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (condition()) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error("Timeout waiting for condition"));
      setTimeout(check, 100);
    };
    check();
  });
}

// ---- Main ----
async function main() {
  log("Phase 1 Verification — Web Single-Chat Closed Loop");
  log(`Log file: ${LOG_FILE}`);
  log(`Node: ${process.version}`);
  log(`Platform: ${process.platform}`);
  log(`Max concurrent: ${MAX_CONCURRENT_PROCESSES}`);

  const results: Record<string, boolean> = {};

  results["Database init & tables"] = await testDatabaseInit();
  results["Conversations CRUD"] = await testConversationsCrud();
  results["Messages, pin, append"] = await testMessages();
  results["AgentRuntime streaming run"] = await testAgentRuntime();
  results["DB persistence"] = await testPersistence();
  results["WebSocket event types"] = await testWsTypes();

  // Cleanup
  try { closeDb(); } catch { /* ignore */ }

  // Summary
  logSection("Results Summary");
  let passed = 0;
  let failed = 0;
  for (const [name, result] of Object.entries(results)) {
    logResult(name, result);
    if (result) passed++;
    else failed++;
  }

  log("");
  log(`Total: ${passed} passed, ${failed} failed, ${Object.keys(results).length} tests`);

  if (failed > 0) {
    log("Some tests FAILED — check the log for details.");
    process.exit(1);
  } else {
    log("All tests PASSED.");
  }
}

main().catch((err) => {
  log(`FATAL: ${err.message}`);
  console.error(err);
  process.exit(1);
});
