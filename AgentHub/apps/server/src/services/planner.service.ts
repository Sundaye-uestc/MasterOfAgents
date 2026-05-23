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

  private buildPlannerPrompt(input: PlannerInput, errorContext: string): string {
    const agentList = input.availableAgents
      .map((a) => `- ${a.name} (id: ${a.id}): ${a.capabilities.join(", ") || "general purpose"}`)
      .join("\n");

    const historySection = input.conversationHistory
      ? `\n\nConversation history:\n${input.conversationHistory}`
      : "";

    const errorSection = errorContext
      ? `\n\nIMPORTANT: Your previous response was invalid. Error: ${errorContext}\nPlease fix the issues and output valid JSON.`
      : "";

    return `你是一个任务规划助手。根据用户请求和可用的 Agent 列表，将请求分解为结构化的任务计划。

可用 Agent：
${agentList}

用户请求：
${input.prompt}${historySection}

请严格按照以下 JSON schema 输出：
{
  "tasks": [
    {
      "id": "unique-task-id",
      "title": "简短的任务标题（中文）",
      "description": "给 Agent 的详细任务描述（中文）",
      "agentId": "从上方列表中选择的 Agent ID",
      "dependencies": ["依赖的前置任务 id", "..."],
      "expectedOutput": "该任务应产出的内容（中文）",
      "riskLevel": "low" | "medium" | "high",
      "writeScope": ["file/path/that/task/may/write"]
    }
  ],
  "reasoning": "任务分解逻辑说明（中文）",
  "estimatedRounds": number
}

规则：
- 每个任务必须有唯一的 id。
- dependencies 必须引用已有的任务 id。
- 不能有循环依赖。
- 将每个任务分配给可用列表中最合适的 Agent。
- 简单请求使用 1 个任务，复杂请求使用 2-5 个任务。
- 高风险任务是指会修改文件或执行破坏性命令的任务。
- title、description、expectedOutput、reasoning 必须使用中文。${errorSection}

只输出 JSON 对象，不要其他文字。`;
  }

  private parsePlanResponse(raw: string): TaskPlan {
    const trimmed = raw.trim();
    // Try to extract JSON from markdown code blocks
    const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    const jsonStr = codeBlockMatch ? codeBlockMatch[1]!.trim() : trimmed;
    return JSON.parse(jsonStr) as TaskPlan;
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
