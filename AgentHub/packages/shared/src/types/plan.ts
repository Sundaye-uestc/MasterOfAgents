// ============================================================
// TaskPlan types — Planner output consumed by Orchestrator
// ============================================================

export interface TaskPlanItem {
  id: string;
  title: string;
  description: string;
  agentId: string;
  dependencies: string[];       // task IDs that must complete first
  expectedOutput: string;
  riskLevel: "low" | "medium" | "high";
  writeScope?: string[];        // file paths this task may write to
}

export interface TaskPlan {
  planId: string;
  tasks: TaskPlanItem[];
  reasoning: string;
  estimatedRounds: number;
}
