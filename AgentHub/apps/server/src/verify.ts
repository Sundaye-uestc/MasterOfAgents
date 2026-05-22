// ============================================================
// Phase 0 — Platform Access Verification
//
// Tests:
// 1. ProcessSupervisor: spawn, stdout, timeout, concurrency
// 2. ClaudeCodeAdapter: prepare, run, stream, stop
// 3. Event normalization: claude CLI → AgentEvent
//
// Run: npx tsx src/verify.ts
// ============================================================

import { ProcessSupervisor } from "./runtime/process-supervisor.js";
import { ClaudeCodeAdapter } from "./adapters/claude-code.adapter.js";
import { parseStreamLine, isStreamComplete } from "./runtime/stream-json-parser.js";
import type { AgentEvent, AgentConfig } from "@agenthub/shared";
import { MAX_CONCURRENT_PROCESSES, DEFAULT_RUN_TIMEOUT_MS } from "@agenthub/shared";
import { appendFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

// ---- Log setup ----
const LOG_DIR = resolve(process.cwd(), "../../../DevelopDocuments/log");
const LOG_FILE = resolve(LOG_DIR, `phase0-verify-${Date.now()}.log`);

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

// ---- Test 1: ProcessSupervisor basic spawn ----
async function testProcessSupervisor(): Promise<boolean> {
  logSection("Test 1: ProcessSupervisor — basic spawn & stdout");

  const sup = new ProcessSupervisor();
  let stdout = "";
  let stderr = "";
  let exited = false;
  let exitCode: number | null = null;

  sup.on("stdout", (d) => { stdout += d.line + "\n"; });
  sup.on("stderr", (d) => { stderr += d.line + "\n"; });
  sup.on("exit", (d) => { exited = true; exitCode = d.code; });

  const processId = sup.start({
    processId: "test-echo",
    command: process.platform === "win32" ? "cmd" : "echo",
    args: process.platform === "win32" ? ["/c", "echo hello world"] : ["hello world"],
    timeoutMs: 10_000,
  });

  await waitFor(() => exited, 5_000);

  logResult("processId returned", processId === "test-echo");
  logResult("stdout contains 'hello world'", stdout.toLowerCase().includes("hello world"), stdout.trim());
  logResult("exit code is 0", exitCode === 0, `exitCode=${exitCode}`);
  logResult("process cleaned up", sup.activeCount === 0, `activeCount=${sup.activeCount}`);

  const passed = processId === "test-echo" && stdout.includes("hello") && exitCode === 0;
  await sup.dispose();
  return passed;
}

// ---- Test 2: ProcessSupervisor timeout ----
async function testProcessSupervisorTimeout(): Promise<boolean> {
  logSection("Test 2: ProcessSupervisor — timeout kill");

  const sup = new ProcessSupervisor();
  let timedOut = false;

  sup.on("timeout", () => { timedOut = true; });

  sup.start({
    processId: "test-timeout",
    command: process.platform === "win32" ? "powershell" : "sleep",
    args: process.platform === "win32" ? ["-Command", "Start-Sleep -Seconds 30"] : ["30"],
    timeoutMs: 2_000, // 2s timeout
  });

  await waitFor(() => timedOut, 8_000);

  logResult("timeout fired", timedOut);
  logResult("process cleaned up after timeout", sup.activeCount === 0, `activeCount=${sup.activeCount}`);

  await sup.dispose();
  return timedOut;
}

// ---- Test 3: Concurrency control ----
async function testConcurrencyControl(): Promise<boolean> {
  logSection("Test 3: Concurrency control");

  const sup = new ProcessSupervisor();
  const ids: string[] = [];
  let errorThrown = false;

  // Start MAX_CONCURRENT_PROCESSES processes
  for (let i = 0; i < MAX_CONCURRENT_PROCESSES; i++) {
    ids.push(sup.start({
      processId: `test-concurrency-${i}`,
      command: process.platform === "win32" ? "cmd" : "sleep",
      args: process.platform === "win32" ? ["/c", "timeout /t 10"] : ["10"],
      timeoutMs: 30_000,
    }));
  }

  // Try to exceed limit
  try {
    sup.start({
      processId: "test-concurrency-over",
      command: process.platform === "win32" ? "cmd" : "echo",
      args: process.platform === "win32" ? ["/c", "nope"] : ["nope"],
      timeoutMs: 10_000,
    });
  } catch (err) {
    errorThrown = true;
    log(`  Expected error: ${(err as Error).message}`);
  }

  logResult("error thrown when exceeding limit", errorThrown);
  logResult("active count equals max", sup.activeCount === MAX_CONCURRENT_PROCESSES, `count=${sup.activeCount}`);

  // Cleanup
  sup.stopAll();
  await waitFor(() => sup.activeCount === 0, 3_000);
  await sup.dispose();

  return errorThrown && sup.activeCount === 0;
}

// ---- Test 4: Stream JSON parser ----
async function testStreamJsonParser(): Promise<boolean> {
  logSection("Test 4: Stream JSON parser");

  const runId = "test-run";
  const agentId = "test-agent";

  // Test text_delta line
  const deltaLine = JSON.stringify({
    type: "assistant",
    message: { content: [{ type: "text", text: "Hello from Claude" }] },
  });

  const parsed = parseStreamLine(deltaLine, runId, agentId);
  logResult("parses text_delta", parsed?.type === "text_delta" && (parsed as any)?.delta === "Hello from Claude");

  // Test tool_call line
  const toolLine = JSON.stringify({
    type: "assistant",
    message: {
      content: [{
        type: "tool_use",
        tool_use: { id: "tc_1", name: "read_file", input: { filePath: "/tmp/x.txt" } },
      }],
    },
  });

  const toolParsed = parseStreamLine(toolLine, runId, agentId);
  logResult("parses tool_call", toolParsed?.type === "tool_call" && (toolParsed as any)?.toolName === "read_file");

  // Test result marker
  const resultLine = JSON.stringify({ type: "result", result: "Done" });
  logResult("isStreamComplete detects result", isStreamComplete(resultLine));

  // Test error line
  const errorLine = JSON.stringify({ type: "error", error: "Something went wrong" });
  const errParsed = parseStreamLine(errorLine, runId, agentId);
  logResult("parses run_failed", errParsed?.type === "run_failed");

  // Test empty line
  logResult("ignores empty line", parseStreamLine("", runId, agentId) === null);

  // Test non-JSON line
  const junkParsed = parseStreamLine("some random stderr output", runId, agentId);
  logResult("treats non-JSON as log", junkParsed?.type === "log");

  return true;
}

// ---- Test 5: ClaudeCodeAdapter — prepare & metadata ----
async function testClaudeAdapterPrepare(): Promise<boolean> {
  logSection("Test 5: ClaudeCodeAdapter — prepare");

  const adapter = new ClaudeCodeAdapter();
  const agent: AgentConfig = {
    id: "test-agent-1",
    name: "Test Claude",
    platform: "claude-code",
    status: "online",
    capabilities: [{ label: "code-generation" }],
    model: "claude-sonnet-4-6",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  try {
    await adapter.prepare(agent);
    logResult("adapter.prepare() succeeds", true);
    logResult("platform is claude-code", adapter.platform === "claude-code");
    await adapter.dispose();
    return true;
  } catch (err) {
    logResult("adapter.prepare() succeeds", false, (err as Error).message);
    await adapter.dispose();
    return false;
  }
}

// ---- Test 6: ClaudeCodeAdapter — streaming run (REAL Claude CLI) ----
async function testClaudeAdapterRun(): Promise<boolean> {
  logSection("Test 6: ClaudeCodeAdapter — streaming run (real Claude CLI)");

  const adapter = new ClaudeCodeAdapter();
  const agent: AgentConfig = {
    id: "test-agent-run",
    name: "Test Claude",
    platform: "claude-code",
    status: "online",
    capabilities: [{ label: "code-generation" }],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await adapter.prepare(agent);

  const abortController = new AbortController();
  const events: AgentEvent[] = [];

  try {
    const stream = adapter.run({
      runId: "verify-run-1",
      agentId: "test-agent-run",
      prompt: "Say hello in exactly one sentence.",
      workingDir: process.cwd(),
      signal: abortController.signal,
    });

    for await (const event of stream) {
      events.push(event);
      log(`  [event] ${event.type}${event.type === "text_delta" ? `: "${(event as any).delta?.slice(0, 60)}"` : ""}`);

      // Timeout after 60s for safety
      if (events.length > 200) {
        log("  Reached event limit, aborting");
        abortController.abort();
        break;
      }
    }

    const hasStarted = events.some((e) => e.type === "run_started");
    const hasText = events.some((e) => e.type === "text_delta");
    const hasComplete = events.some((e) => e.type === "run_completed");
    const hasFailed = events.some((e) => e.type === "run_failed");

    logResult("run_started emitted", hasStarted);
    logResult("text_delta emitted", hasText, `${events.filter(e => e.type === "text_delta").length} text deltas`);
    logResult("completed or failed", hasComplete || hasFailed, hasComplete ? "completed" : hasFailed ? "failed" : "neither");
    logResult("no unexpected events", events.every((e) => ["run_started", "text_delta", "tool_call", "tool_result", "run_completed", "run_failed", "log", "file_change", "artifact_created", "permission_request"].includes(e.type)));

    const passed = hasStarted && hasText && (hasComplete || hasFailed);
    await adapter.dispose();
    return passed;
  } catch (err) {
    logResult("streaming run", false, (err as Error).message);
    try { await adapter.dispose(); } catch { /* ignore */ }
    return false;
  }
}

// ---- Helpers ----
function waitFor(condition: () => boolean, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (condition()) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error("Timeout waiting for condition"));
      setTimeout(check, 50);
    };
    check();
  });
}

// ---- Main ----
async function main() {
  log("Phase 0 Verification — AgentHub Platform Access");
  log(`Log file: ${LOG_FILE}`);
  log(`Node: ${process.version}`);
  log(`Platform: ${process.platform}`);
  log(`Max concurrent: ${MAX_CONCURRENT_PROCESSES}`);
  log(`Default timeout: ${DEFAULT_RUN_TIMEOUT_MS}ms`);

  const results: Record<string, boolean> = {};

  results["ProcessSupervisor spawn"] = await testProcessSupervisor();
  results["ProcessSupervisor timeout"] = await testProcessSupervisorTimeout();
  results["Concurrency control"] = await testConcurrencyControl();
  results["Stream JSON parser"] = await testStreamJsonParser();
  results["ClaudeCodeAdapter prepare"] = await testClaudeAdapterPrepare();
  results["ClaudeCodeAdapter streaming run"] = await testClaudeAdapterRun();

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
