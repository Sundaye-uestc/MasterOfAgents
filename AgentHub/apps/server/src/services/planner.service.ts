// ============================================================
// PlannerService — LLM-based task decomposition
// Generates structured TaskPlan JSON for orchestrator consumption.
// ============================================================

import type { TaskPlan, TaskPlanItem } from "@agenthub/shared";
import { config } from "../lib/config.js";
import { newId } from "../lib/ids.js";

interface PlannerInput {
  prompt: string;
  availableAgents: Array<{ id: string; name: string; capabilities: string[] }>;
  conversationHistory?: string;
}

export class PlannerService {
  private model: string;
  private apiUrl: string;
  private apiKey: string;
  private apiFormat: "anthropic" | "openai";

  constructor(options?: { model?: string; apiUrl?: string; apiKey?: string; apiFormat?: "anthropic" | "openai" }) {
    this.model = options?.model ?? config.plannerModel;
    this.apiUrl = options?.apiUrl ?? config.plannerApiUrl;
    this.apiKey = options?.apiKey ?? config.plannerApiKey;
    this.apiFormat = options?.apiFormat ?? config.plannerApiFormat;
  }

  async generateTaskPlan(input: PlannerInput): Promise<TaskPlan> {
    let lastError = "";

    // Extract @agent assignments from user prompt
    input = this.preprocessMentions(input);

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const prompt = this.buildPlannerPrompt(input, attempt > 0 ? lastError : "");
        const raw = await this.callLLM(prompt);
        const plan = this.parsePlanResponse(raw);

        const validation = this.validateTaskPlan(plan);
        if (validation.valid) {
          plan.planId = newId();
          return plan;
        }

        lastError = validation.errors?.join("; ") ?? "Unknown validation error";
        console.warn(`[Planner] attempt ${attempt + 1} validation failed: ${lastError}`);
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        console.warn(`[Planner] attempt ${attempt + 1} error: ${lastError}`);
      }
    }

    // Degradation: single-task plan = direct execution
    return this.degradedPlan(input);
  }

  validateTaskPlan(plan: unknown): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!plan || typeof plan !== "object") {
      errors.push("plan is not an object");
      return { valid: false, errors };
    }

    const p = plan as Record<string, unknown>;

    if (!Array.isArray(p["tasks"])) {
      errors.push("tasks must be an array");
      return { valid: false, errors };
    }

    const tasks = p["tasks"] as unknown[];
    const taskIds = new Set<string>();

    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i] as Record<string, unknown>;
      const id = t["id"] as string;

      if (!id) {
        errors.push(`task[${i}]: missing id`);
        continue;
      }
      if (taskIds.has(id)) {
        errors.push(`task[${i}]: duplicate id "${id}"`);
      }
      taskIds.add(id);

      if (!t["title"]) errors.push(`task[${i}] "${id}": missing title`);
      if (!t["description"]) errors.push(`task[${i}] "${id}": missing description`);
      if (!t["agentId"]) errors.push(`task[${i}] "${id}": missing agentId`);
      if (!Array.isArray(t["dependencies"])) errors.push(`task[${i}] "${id}": dependencies must be an array`);
      if (!t["expectedOutput"]) errors.push(`task[${i}] "${id}": missing expectedOutput`);
      if (!["low", "medium", "high"].includes(t["riskLevel"] as string)) {
        errors.push(`task[${i}] "${id}": riskLevel must be low/medium/high, got "${t["riskLevel"]}"`);
      }
    }

    // Check dependency references exist
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i] as Record<string, unknown>;
      const deps = (t["dependencies"] as string[]) ?? [];
      for (const depId of deps) {
        if (!taskIds.has(depId)) {
          errors.push(`task[${i}] "${t["id"]}": dependency "${depId}" does not exist`);
        }
      }
    }

    // Check for cycles in DAG
    if (errors.length === 0) {
      const cycleErr = this.detectCycle(tasks as TaskPlanItem[]);
      if (cycleErr) errors.push(`circular dependency: ${cycleErr}`);
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  private detectCycle(tasks: TaskPlanItem[]): string | null {
    const visited = new Set<string>();
    const inStack = new Set<string>();

    const dfs = (taskId: string): boolean => {
      visited.add(taskId);
      inStack.add(taskId);

      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        for (const depId of task.dependencies) {
          if (inStack.has(depId)) return true;
          if (!visited.has(depId) && dfs(depId)) return true;
        }
      }

      inStack.delete(taskId);
      return false;
    };

    for (const t of tasks) {
      if (!visited.has(t.id)) {
        if (dfs(t.id)) {
          // Find the cycle path
          return Array.from(inStack).join(" → ");
        }
      }
    }

    return null;
  }

  private degradedPlan(input: PlannerInput): TaskPlan {
    const firstAgent = input.availableAgents[0];
    const task: TaskPlanItem = {
      id: newId(),
      title: "Execute request directly",
      description: input.prompt,
      agentId: firstAgent?.id ?? "default-claude",
      dependencies: [],
      expectedOutput: "Complete the requested task",
      riskLevel: "low",
      writeScope: [],
    };

    return {
      planId: newId(),
      tasks: [task],
      reasoning: "Planner fell back to single-task execution after failing to generate a valid plan.",
      estimatedRounds: 1,
    };
  }

  /** Extract @agent mentions from prompt and inject assignment hints */
  private preprocessMentions(input: PlannerInput): PlannerInput {
    // Find @mentions: match "@Name Name" patterns like "@Claude Code", "@Codex"
    const mentionRegex = /@(\S+(?:\s+\S+)?)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(input.prompt)) !== null) {
      if (match[1]) mentions.push(match[1].trim());
    }

    if (mentions.length === 0) {
      return input;
    }

    // Match mentions to available agents (case-insensitive partial match)
    const assignments: Array<{ agentId: string; agentName: string; mention: string }> = [];
    for (const mention of mentions) {
      const lower = mention.toLowerCase();
      const agent = input.availableAgents.find(
        (a) =>
          a.name.toLowerCase().includes(lower) ||
          a.id.toLowerCase().includes(lower) ||
          lower.includes(a.name.toLowerCase())
      );
      if (agent && !assignments.some((x) => x.agentId === agent.id)) {
        assignments.push({ agentId: agent.id, agentName: agent.name, mention });
      }
    }

    if (assignments.length === 0) {
      return input;
    }

    // Build assignment hints for the prompt
    const hint = assignments
      .map((a) => `"${a.mention}" → Agent ID: ${a.agentId}`)
      .join(", ");

    return {
      ...input,
      prompt: `${input.prompt}\n\n[用户通过 @ 指定：${hint}。请严格按此分配创建独立任务。]`,
    };
  }

  private buildPlannerPrompt(input: PlannerInput, errorContext: string): string {
    const agentListSimple = input.availableAgents
      .map((a) => `- ${a.name}（ID: ${a.id}）`)
      .join("\n");

    const historySection = input.conversationHistory
      ? `\n\n对话历史：\n${input.conversationHistory}`
      : "";

    const errorSection = errorContext
      ? `\n\n【重要】上轮输出无效：${errorContext}\n修正后重新输出。`
      : "";

    return `你的唯一任务是：将以下用户请求拆分为子任务。

可用 Agent：${agentListSimple}

用户请求：${input.prompt}${historySection}

请输出 JSON（不要其他文字）：
{
  "tasks": [
    {
      "id": "task-1",
      "title": "任务标题（中文）",
      "description": "详细描述（中文，原样传达用户需求给 Agent）",
      "agentId": "上述 Agent ID",
      "dependencies": [],
      "expectedOutput": "期望产出（中文）",
      "riskLevel": "low",
      "writeScope": []
    }
  ],
  "reasoning": "拆分理由（中文）",
  "estimatedRounds": 1
}

关键规则：
- 直接执行用户请求。不要分析 Agent 本身，不要讨论 Agent 能力。
- 用户 @N 个 Agent → 至少 N 个任务，严格对应。
- 无依赖间用空数组 []。
- riskLevel 只填 "low"/"medium"/"high"。${errorSection}

只输出 JSON。`;
  }

  private parsePlanResponse(raw: string): TaskPlan {
    console.log(`[Planner] raw LLM response (length=${raw.length}):`);
    console.log(raw.substring(0, 2000));

    const trimmed = raw.trim();
    // Try to extract JSON from markdown code blocks first
    const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    let jsonStr = codeBlockMatch ? codeBlockMatch[1]!.trim() : trimmed;

    // Try to extract JSON object from surrounding text (find first { to last })
    const firstBrace = jsonStr.indexOf("{");
    const lastBrace = jsonStr.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
    }

    try {
      return JSON.parse(jsonStr) as TaskPlan;
    } catch (e) {
      throw new Error(`Failed to parse JSON from response: ${(e as Error).message}`);
    }
  }

  private async callLLM(prompt: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error("No API key configured for planner. Set the API key for your chosen provider in .env");
    }

    if (this.apiFormat === "anthropic") {
      return this.callAnthropic(prompt);
    }
    return this.callOpenAICompatible(prompt);
  }

  private async callAnthropic(prompt: string): Promise<string> {
    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Planner API error ${response.status}: ${text}`);
    }

    const data = await response.json() as {
      content?: Array<{ type: string; text?: string }>;
      error?: { message: string };
    };

    if (data.error) {
      throw new Error(`Planner API error: ${data.error.message}`);
    }

    const content = data.content?.find((c) => c.type === "text");
    if (!content?.text) {
      throw new Error("No text content in planner API response");
    }

    return content.text;
  }

  private async callOpenAICompatible(prompt: string): Promise<string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };

    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Planner API error ${response.status}: ${text}`);
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message: string };
    };

    if (data.error) {
      throw new Error(`Planner API error: ${data.error.message}`);
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("No text content in planner API response");
    }

    return content;
  }
}
