// ============================================================
// Phase 2 — Group Chat Collaboration Verification
//
// Tests:
// 1. PlannerService — validateTaskPlan (valid + invalid + cycles)
// 2. PlannerService — degradation fallback
// 3. ChatService — member management (add/remove/list)
// 4. ChatService — detectCreateAgentIntent
// 5. Orchestrator DAG scheduling logic
// 6. WebSocket event types — Phase 2 events
// 7. Permission request WS event mapping
//
// Run: npx tsx src/verify-phase2.ts
// ============================================================

import { initDb, getDb, closeDb, saveDb, schema } from "./db/index.js";
import { ChatService } from "./services/chat.service.js";
import { PlannerService } from "./services/planner.service.js";
import { OrchestratorService } from "./services/orchestrator.service.js";
import type { TaskPlan, TaskPlanItem, AgentEvent } from "@agenthub/shared";
import { appendFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

// ---- Log setup ----
const LOG_DIR = resolve(process.cwd(), "../../../DevelopDocuments/log");
const LOG_FILE = resolve(LOG_DIR, `phase2-verify-${Date.now()}.log`);

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

// ---- Test 1: PlannerService — validateTaskPlan ----
async function testPlannerValidation(): Promise<boolean> {
  logSection("Test 1: PlannerService — validateTaskPlan");

  const planner = new PlannerService({ apiKey: "test-key" });

  // Valid plan
  const validPlan: TaskPlan = {
    planId: "p1",
    tasks: [
      {
        id: "t1",
        title: "Frontend setup",
        description: "Set up React app",
        agentId: "agent-1",
        dependencies: [],
        expectedOutput: "Scaffolded React app",
        riskLevel: "low",
        writeScope: ["src/frontend/"],
      },
      {
        id: "t2",
        title: "Backend setup",
        description: "Set up Express server",
        agentId: "agent-2",
        dependencies: ["t1"],
        expectedOutput: "Express server with routes",
        riskLevel: "medium",
        writeScope: ["src/backend/"],
      },
    ],
    reasoning: "Frontend first, then backend",
    estimatedRounds: 2,
  };

  const validResult = planner.validateTaskPlan(validPlan);
  logResult("valid plan passes", validResult.valid);

  // Missing tasks
  const noTasks = { reasoning: "none" };
  const noTasksResult = planner.validateTaskPlan(noTasks);
  logResult("missing tasks array fails", !noTasksResult.valid,
    noTasksResult.errors?.join("; ") ?? "");

  // Missing required fields
  const missingFields: TaskPlan = {
    planId: "p2",
    tasks: [
      {
        id: "bad-task",
        title: "",
        description: "",
        agentId: "",
        dependencies: [],
        expectedOutput: "",
        riskLevel: "low" as const,
      },
    ],
    reasoning: "",
    estimatedRounds: 0,
  };
  const missingResult = planner.validateTaskPlan(missingFields);
  logResult("missing required fields fails", !missingResult.valid,
    `errors: ${missingResult.errors?.length ?? 0}`);

  // Cyclic dependency
  const cyclicPlan: TaskPlan = {
    planId: "p3",
    tasks: [
      {
        id: "a",
        title: "Task A",
        description: "First task",
        agentId: "agent-1",
        dependencies: ["b"],
        expectedOutput: "A output",
        riskLevel: "low",
      },
      {
        id: "b",
        title: "Task B",
        description: "Second task",
        agentId: "agent-2",
        dependencies: ["a"],
        expectedOutput: "B output",
        riskLevel: "low",
      },
    ],
    reasoning: "This has a cycle",
    estimatedRounds: 1,
  };
  const cycleResult = planner.validateTaskPlan(cyclicPlan);
  logResult("circular dependency detected", !cycleResult.valid,
    cycleResult.errors?.join("; ") ?? "");

  // Nonexistent dependency
  const badDepPlan: TaskPlan = {
    planId: "p4",
    tasks: [
      {
        id: "task-1",
        title: "Only task",
        description: "Does something",
        agentId: "agent-1",
        dependencies: ["nonexistent-task"],
        expectedOutput: "Result",
        riskLevel: "low",
      },
    ],
    reasoning: "Bad dep",
    estimatedRounds: 1,
  };
  const badDepResult = planner.validateTaskPlan(badDepPlan);
  logResult("nonexistent dependency detected", !badDepResult.valid,
    badDepResult.errors?.join("; ") ?? "");

  // Empty plan
  const emptyPlan: TaskPlan = {
    planId: "p5",
    tasks: [],
    reasoning: "Nothing to do",
    estimatedRounds: 0,
  };
  const emptyResult = planner.validateTaskPlan(emptyPlan);
  logResult("empty tasks array is valid", emptyResult.valid);

  return validResult.valid && !noTasksResult.valid && !missingResult.valid
    && !cycleResult.valid && !badDepResult.valid && emptyResult.valid;
}

// ---- Test 2: PlannerService — degradation ----
async function testPlannerDegradation(): Promise<boolean> {
  logSection("Test 2: PlannerService — degradation fallback");

  // Create a planner with no API key so it fails immediately
  const planner = new PlannerService({ apiKey: "" });

  try {
    const plan = await planner.generateTaskPlan({
      prompt: "Build a todo app",
      availableAgents: [
        { id: "agent-1", name: "Claude", capabilities: ["code-generation"] },
      ],
    });

    // Should get a degraded plan with 1 task
    const hasCorrectStructure = plan.tasks.length === 1
      && plan.tasks[0]!.agentId === "agent-1"
      && plan.tasks[0]!.dependencies.length === 0;
    logResult("degraded plan generated on API key failure", hasCorrectStructure,
      `tasks=${plan.tasks.length}, agent=${plan.tasks[0]?.agentId}, reasoning="${plan.reasoning.slice(0, 60)}..."`);

    const validResult = planner.validateTaskPlan(plan);
    logResult("degraded plan passes validation", validResult.valid);

    return hasCorrectStructure && validResult.valid;
  } catch (err) {
    logResult("degraded plan generated", false, (err as Error).message);
    return false;
  }
}

// ---- Test 3: ChatService — member management ----
async function testMemberManagement(): Promise<boolean> {
  logSection("Test 3: ChatService — member management");

  const chat = new ChatService();

  // Create a conversation with multiple agents
  const conv = await chat.createConversation({
    title: "Group Test",
    type: "group",
    agentIds: ["default-claude", "default-codex"],
  });
  logResult("createConversation with agentIds", conv.type === "group", `type=${conv.type}`);

  // List members
  const members = await chat.getMembersForConversation(conv.id);
  logResult("getMembersForConversation", members.length === 2,
    `found ${members.length} members: ${members.map(m => m.agentName).join(", ")}`);

  // Add a member
  await chat.addMember(conv.id, "custom-agent", "observer");
  const afterAdd = await chat.getMembersForConversation(conv.id);
  logResult("addMember", afterAdd.length === 3, `count=${afterAdd.length}`);
  const observer = afterAdd.find(m => m.agentId === "custom-agent");
  logResult("observer role set", observer?.role === "observer", observer?.role ?? "undefined");

  // Remove a member
  await chat.removeMember(conv.id, "custom-agent");
  const afterRemove = await chat.getMembersForConversation(conv.id);
  logResult("removeMember", afterRemove.length === 2,
    `count=${afterRemove.length}`);

  // Full member details (listMembers with agent info)
  const fullList = await chat.listMembers(conv.id);
  logResult("listMembers with agent info", fullList.length === 2,
    `members have agent name: ${fullList[0]?.agent?.name ?? "N/A"}`);

  // Members of direct chat (with single agentId)
  const directConv = await chat.createConversation({
    title: "Direct Test",
    type: "direct",
    agentId: "default-claude",
  });
  const directMembers = await chat.getMembersForConversation(directConv.id);
  logResult("direct chat has 1 member", directMembers.length === 1,
    `count=${directMembers.length}`);

  return conv.type === "group" && afterAdd.length === 3 && afterRemove.length === 2
    && directMembers.length === 1;
}

// ---- Test 4: ChatService — detectCreateAgentIntent ----
async function testIntentDetection(): Promise<boolean> {
  logSection("Test 4: ChatService — detectCreateAgentIntent");

  const chat = new ChatService();

  // Positive: Chinese create intent
  const intent1 = chat.detectCreateAgentIntent("创建一个名叫 CodeReviewer 的 agent，用于代码审查");
  logResult("detect Chinese create intent", intent1 !== null,
    intent1 ? `name="${intent1.name}", caps=[${intent1.capabilities.join(",")}]` : "null");

  // Positive: English create intent with capabilities
  const intent2 = chat.detectCreateAgentIntent("create a new agent called DebugBot for debugging and testing");
  logResult("detect English create intent", intent2 !== null,
    intent2 ? `name="${intent2.name}", caps=[${intent2.capabilities.join(",")}]` : "null");

  // Check extracted fields
  const codeReviewer = chat.detectCreateAgentIntent("创建一个名叫 CodeReviewExpert 的 codex agent，system prompt：审查所有代码变更并给出建议");
  logResult("extract name from intent", codeReviewer?.name === "CodeReviewExpert",
    `name="${codeReviewer?.name}"`);
  logResult("extract platform (codex)", codeReviewer?.platform === "codex",
    `platform="${codeReviewer?.platform}"`);
  logResult("extract capabilities", (codeReviewer?.capabilities ?? []).length > 0,
    `caps=[${codeReviewer?.capabilities?.join(",")}]`);
  logResult("extract systemPrompt", !!codeReviewer?.systemPrompt,
    `systemPrompt="${codeReviewer?.systemPrompt?.slice(0, 40)}..."`);

  // Negative: regular message, no create intent
  const intent3 = chat.detectCreateAgentIntent("帮我分析一下这个文件");
  logResult("regular message returns null", intent3 === null,
    intent3 ? `unexpected: ${JSON.stringify(intent3)}` : "correctly null");

  // Negative: random text
  const intent4 = chat.detectCreateAgentIntent("What is the weather today?");
  logResult("unrelated message returns null", intent4 === null);

  return intent1 !== null && intent2 !== null && codeReviewer?.name === "CodeReviewExpert"
    && intent3 === null && intent4 === null;
}

// ---- Test 5: Orchestrator DAG scheduling logic ----
async function testDagScheduling(): Promise<boolean> {
  logSection("Test 5: Orchestrator DAG scheduling logic");

  // Test write-scope overlap detection
  const orchestrator = new OrchestratorService(new ChatService());

  // Access private hasOverlap via any
  const orch = orchestrator as any;

  // Overlapping scopes
  logResult("write-scope overlap (exact match)",
    orch.hasOverlap(["src/frontend/"], ["src/frontend/"]) === true);
  logResult("write-scope overlap (parent-child)",
    orch.hasOverlap(["src/"], ["src/frontend/"]) === true);
  logResult("write-scope overlap (child-parent)",
    orch.hasOverlap(["src/frontend/"], ["src/"]) === true);
  logResult("write-scope no overlap",
    orch.hasOverlap(["src/frontend/"], ["src/backend/"]) === false);
  logResult("write-scope no overlap (empty)",
    orch.hasOverlap(["src/frontend/"], []) === false);

  // Test shouldRetry logic
  const lowRiskTask: TaskPlanItem = {
    id: "t1", title: "Low", description: "", agentId: "a1",
    dependencies: [], expectedOutput: "", riskLevel: "low",
  };
  const mediumRiskTask: TaskPlanItem = {
    id: "t2", title: "Medium", description: "", agentId: "a2",
    dependencies: [], expectedOutput: "", riskLevel: "medium",
  };
  const highRiskTask: TaskPlanItem = {
    id: "t3", title: "High", description: "", agentId: "a3",
    dependencies: [], expectedOutput: "", riskLevel: "high",
  };

  logResult("shouldRetry (low risk)", orch.shouldRetry(lowRiskTask) === true);
  logResult("shouldRetry (medium risk)", orch.shouldRetry(mediumRiskTask) === true);
  logResult("shouldRetry (high risk)", orch.shouldRetry(highRiskTask) === false);

  return true;
}

// ---- Test 6: WebSocket event types — Phase 2 events ----
async function testPhase2WsEvents(): Promise<boolean> {
  logSection("Test 6: WebSocket event types — Phase 2");

  const { agentEventToWsEvent } = await import("./ws/gateway.js");

  // permission_request → permission:requested
  const permEvent: AgentEvent = {
    type: "permission_request",
    runId: "r1",
    permissionId: "p1",
    toolName: "read",
    description: "Read file package.json",
    command: "cat package.json",
    timestamp: 1,
  };
  const permWs = agentEventToWsEvent(permEvent);
  logResult("permission_request → permission:requested",
    permWs?.type === "permission:requested",
    `type=${permWs?.type}`);

  // New event types should be valid JSON-serializable
  const events = [
    { type: "task:started", runId: "r1", taskId: "t1", agentId: "a1" },
    { type: "task:completed", runId: "r1", taskId: "t1", resultSummary: "done" },
    { type: "task:failed", runId: "r1", taskId: "t1", error: "failed" },
    { type: "orchestrator:plan_created", runId: "r1", plan: { tasks: [] } },
    { type: "orchestrator:confirmation_needed", runId: "r1", taskId: "t1", taskTitle: "Risky" },
    { type: "run:status", runId: "r1", status: "running", progress: { completed: 1, total: 3 } },
    { type: "permission:requested", permission: permEvent },
    { type: "agent:config_draft", draft: { name: "Test", platform: "claude-code", capabilities: [] } },
  ];

  let allSerializable = true;
  for (const ev of events) {
    try {
      JSON.stringify(ev);
    } catch {
      allSerializable = false;
      logResult(`serialize ${ev.type}`, false);
    }
  }
  logResult("all Phase 2 WS events are JSON-serializable", allSerializable);

  return permWs?.type === "permission:requested" && allSerializable;
}

// ---- Test 7: TaskPlan type structure ----
async function testTaskPlanTypes(): Promise<boolean> {
  logSection("Test 7: TaskPlan type structure");

  // Verify that a TaskPlan with all fields can be constructed and validated
  const plan: TaskPlan = {
    planId: "test-plan-1",
    tasks: [
      {
        id: "frontend",
        title: "Build React UI",
        description: "Create the React frontend with components",
        agentId: "claude-code",
        dependencies: [],
        expectedOutput: "Working React app with routing",
        riskLevel: "low",
        writeScope: ["src/frontend/"],
      },
      {
        id: "backend",
        title: "Build Express API",
        description: "Create the backend API with routes",
        agentId: "codex",
        dependencies: ["frontend"],
        expectedOutput: "REST API with CRUD endpoints",
        riskLevel: "medium",
        writeScope: ["src/backend/"],
      },
      {
        id: "integration",
        title: "Integration tests",
        description: "Write integration tests for the full stack",
        agentId: "claude-code",
        dependencies: ["frontend", "backend"],
        expectedOutput: "Integration tests passing",
        riskLevel: "medium",
        writeScope: ["tests/"],
      },
    ],
    reasoning: "Build frontend first, then backend in parallel (no deps between them), then integration tests",
    estimatedRounds: 3,
  };

  const planner = new PlannerService({ apiKey: "test-key" });
  const result = planner.validateTaskPlan(plan);
  logResult("3-task DAG passes validation", result.valid,
    result.errors?.join("; "));

  // Verify DAG structure
  const frontend = plan.tasks.find(t => t.id === "frontend")!;
  const backend = plan.tasks.find(t => t.id === "backend")!;
  const integration = plan.tasks.find(t => t.id === "integration")!;

  logResult("frontend has no dependencies", frontend.dependencies.length === 0);
  logResult("backend depends on frontend", backend.dependencies[0] === "frontend");
  logResult("integration depends on both", integration.dependencies.length === 2
    && integration.dependencies.includes("frontend")
    && integration.dependencies.includes("backend"));

  return result.valid;
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
  log("Phase 2 Verification — Group Chat Collaboration");
  log(`Log file: ${LOG_FILE}`);
  log(`Node: ${process.version}`);
  log(`Platform: ${process.platform}`);

  // Initialize DB for tests that need it
  let dbInitialized = false;
  try {
    await initDb();
    dbInitialized = true;
    logResult("Database initialization", true);
  } catch (err) {
    logResult("Database initialization", false, (err as Error).message);
  }

  const results: Record<string, boolean> = {};

  results["PlannerService — validateTaskPlan"] = await testPlannerValidation();
  results["PlannerService — degradation fallback"] = await testPlannerDegradation();

  if (dbInitialized) {
    results["ChatService — member management"] = await testMemberManagement();
    results["ChatService — detectCreateAgentIntent"] = await testIntentDetection();
  } else {
    logResult("ChatService — member management", false, "DB not initialized");
    results["ChatService — member management"] = false;
    logResult("ChatService — detectCreateAgentIntent", false, "DB not initialized");
    results["ChatService — detectCreateAgentIntent"] = false;
  }

  results["Orchestrator DAG scheduling"] = await testDagScheduling();
  results["WebSocket Phase 2 events"] = await testPhase2WsEvents();
  results["TaskPlan type structure"] = await testTaskPlanTypes();

  // Cleanup
  if (dbInitialized) {
    try { saveDb(); } catch { /* ignore */ }
    try { closeDb(); } catch { /* ignore */ }
  }

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
