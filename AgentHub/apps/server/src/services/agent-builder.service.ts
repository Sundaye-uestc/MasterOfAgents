// ============================================================
// AgentBuilderService — LLM-powered agent creation & polishing
// Reuses the same LLM infrastructure as PlannerService.
// ============================================================

import { config } from "../lib/config.js";
import { matchToolSetsByKeywords } from "@agenthub/shared";
import type { ParsedAgentIntent, PolishPromptResponse } from "@agenthub/shared";

export class AgentBuilderService {
  private model: string;
  private apiUrl: string;
  private apiKey: string;
  private apiFormat: "anthropic" | "openai";

  constructor(options?: {
    model?: string;
    apiUrl?: string;
    apiKey?: string;
    apiFormat?: "anthropic" | "openai";
  }) {
    // Resolve all config from process.env at construction time (dotenv already loaded).
    // Do NOT use config.plannerApiKey/Url/Format as defaults — they were evaluated
    // at ESM import time before dotenv.config() ran and point to the wrong provider.
    const provider = process.env["PLANNER_PROVIDER"] ?? "anthropic";
    const isOpenAI = ["dashscope", "deepseek", "dobrain", "moonshot", "openai", "openrouter", "glm"].includes(provider);

    const providerDefaults: Record<string, { endpoint: string; model: string }> = {
      anthropic:    { endpoint: "https://api.anthropic.com/v1/messages",               model: "claude-sonnet-4-6-20250514" },
      dashscope:    { endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", model: "qwen-max" },
      deepseek:     { endpoint: "https://api.deepseek.com/v1/chat/completions",        model: "deepseek-chat" },
      dobrain:      { endpoint: "https://api.dobrain.com/v1/chat/completions",         model: "dobrain-v1" },
      moonshot:     { endpoint: "https://api.moonshot.cn/v1/chat/completions",         model: "moonshot-v1-8k" },
      openai:       { endpoint: "https://api.openai.com/v1/chat/completions",          model: "gpt-4o" },
      openrouter:   { endpoint: "https://openrouter.ai/api/v1/chat/completions",       model: "anthropic/claude-sonnet-4" },
      glm:          { endpoint: "https://open.bigmodel.cn/api/paas/v4/chat/completions", model: "glm-4-plus" },
    };
    const def = providerDefaults[provider] ?? providerDefaults.anthropic;

    // Explicit options > PLANNER_* env vars > provider defaults
    this.model     = options?.model     || process.env["PLANNER_MODEL"]  || def.model;
    this.apiUrl    = options?.apiUrl    || process.env["PLANNER_API_URL"] || def.endpoint;
    this.apiKey    = options?.apiKey    || this.resolveEnvApiKey();
    this.apiFormat = options?.apiFormat ?? (isOpenAI ? "openai" : "anthropic");
  }

  /** Re-read API key from process.env at runtime (dotenv is loaded by now) */
  private resolveEnvApiKey(): string {
    const provider = process.env["PLANNER_PROVIDER"] ?? "anthropic";
    const providerEnvKeys: Record<string, string> = {
      anthropic: "ANTHROPIC_API_KEY",
      dashscope: "DASHSCOPE_API_KEY",
      deepseek: "DEEPSEEK_API_KEY",
      dobrain: "DOBRAIN_API_KEY",
      moonshot: "MOONSHOT_API_KEY",
      openai: "OPENAI_API_KEY",
      openrouter: "OPENROUTER_API_KEY",
      glm: "GLM_API_KEY",
    };
    const candidates = [
      providerEnvKeys[provider],
      "PLANNER_API_KEY",
      "ANTHROPIC_API_KEY",
    ].filter(Boolean) as string[];

    for (const key of candidates) {
      const val = process.env[key];
      if (val && val.length > 10 && !val.startsWith("your-")) return val;
    }
    return "";
  }

  // ============================================================
  // Parse user's natural-language description into structured config
  // ============================================================
  async parseCreationIntent(userDescription: string): Promise<ParsedAgentIntent> {
    const prompt = this.buildParseIntentPrompt(userDescription);
    const raw = await this.callLLM(prompt);
    const parsed = this.parseJsonResponse(raw);

    const name = (parsed["name"] as string) ?? "Custom Agent";
    const platform = (parsed["platform"] as string) ?? "claude-code";
    const systemPrompt = (parsed["systemPrompt"] as string) ?? "";
    const capabilities: string[] = Array.isArray(parsed["capabilities"])
      ? (parsed["capabilities"] as string[])
      : [];

    // Auto-match tool sets from description + capabilities
    const toolSetIds = matchToolSetsByKeywords(userDescription, capabilities);

    return {
      name,
      platform,
      systemPrompt,
      capabilities,
      toolSetIds,
    };
  }

  // ============================================================
  // Polish a draft system prompt — LLM improves structure & clarity
  // ============================================================
  async polishSystemPrompt(draft: string): Promise<PolishPromptResponse> {
    const prompt = this.buildPolishPrompt(draft);
    const raw = await this.callLLM(prompt);
    const parsed = this.parseJsonResponse(raw);

    return {
      systemPrompt: (parsed["systemPrompt"] as string) ?? draft,
      capabilities: Array.isArray(parsed["capabilities"])
        ? (parsed["capabilities"] as string[])
        : [],
    };
  }

  // ============================================================
  // Prompt builders
  // ============================================================

  private buildParseIntentPrompt(description: string): string {
    return `你是一个 Agent 配置助手。用户用自然语言描述他们想要的 AI Agent。
你的任务是将描述转化为结构化的 JSON 配置。

用户描述：
${description}

请输出 JSON（不要其他文字）：
{
  "name": "Agent 名称（中文，简短好记，2-8字）",
  "platform": "claude-code | codex | opencode | custom（推理平台，默认 claude-code）",
  "systemPrompt": "详细的 System Prompt（中文，包含角色定义、能力范围、回复风格、工具使用指引。至少200字，告诉 Agent 它是什么、擅长什么、如何帮助用户）",
  "capabilities": ["能力标签，如 📊 数据分析、🐛 调试排错、🎨 前端开发 等"]
}

规则：
- name: 从描述中提取或创造合适名称，要有辨识度
- platform: 如果用户没指定，填 "claude-code"
- systemPrompt: 必须详细、专业。包含：1) 角色定义 2) 核心能力 3) 回复风格 4) 可用工具指引
- capabilities: 中文标签，每个以 emoji 开头（如 📊 数据分析），3~5个即可，不要太多

只输出 JSON。`;
  }

  private buildPolishPrompt(draft: string): string {
    return `你是一个 System Prompt 优化助手。用户给出一个草稿 System Prompt。
请优化它，使其更加专业、结构化、详细。

草稿 System Prompt：
${draft}

请输出 JSON（不要其他文字）：
{
  "systemPrompt": "优化后的 System Prompt（中文，保留原意，增加角色定义、工具使用指引、回复风格说明。结构清晰，至少150字）",
  "capabilities": ["从 prompt 中检测到的能力标签，如 📝 PPT生成、💻 代码编写、🔧 调试排错"]
}

规则：
- 保留用户的原始意图和风格偏好
- 增加缺失的部分（角色定义、工具指引、回复风格）
- 结构化为清晰的段落
- capabilities: 中文标签，每个以 emoji 开头（如 📝 PPT生成），3~5个即可

只输出 JSON。`;
  }

  // ============================================================
  // LLM call — replicates PlannerService pattern
  // ============================================================

  private async callLLM(prompt: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error(
        "No API key configured for agent builder. Set the API key for your chosen provider in .env"
      );
    }

    let lastError = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const finalPrompt =
          attempt > 0 && lastError
            ? `${prompt}\n\n【重要】上轮输出无效：${lastError}\n修正后重新输出。只输出 JSON。`
            : prompt;

        if (this.apiFormat === "anthropic") {
          return await this.callAnthropic(finalPrompt);
        }
        return await this.callOpenAICompatible(finalPrompt);
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        console.warn(`[AgentBuilder] attempt ${attempt + 1} error: ${lastError}`);
        if (attempt === 1) throw err;
      }
    }
    throw new Error("Agent builder LLM call failed after 2 attempts");
  }

  // ============================================================
  // JSON response parser — same pattern as PlannerService
  // ============================================================

  private parseJsonResponse(raw: string): Record<string, unknown> {
    console.log(`[AgentBuilder] raw LLM response (length=${raw.length}):`);
    console.log(raw.substring(0, 2000));

    const trimmed = raw.trim();
    // Try markdown code block first
    const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    let jsonStr = codeBlockMatch ? codeBlockMatch[1]!.trim() : trimmed;

    // Extract JSON object from surrounding text
    const firstBrace = jsonStr.indexOf("{");
    const lastBrace = jsonStr.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
    }

    try {
      return JSON.parse(jsonStr) as Record<string, unknown>;
    } catch (e) {
      throw new Error(
        `Failed to parse JSON from agent builder response: ${(e as Error).message}`
      );
    }
  }

  // ============================================================
  // Provider-specific API calls
  // ============================================================

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
      throw new Error(`AgentBuilder API error ${response.status}: ${text}`);
    }

    const data = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
      error?: { message: string };
    };

    if (data.error) {
      throw new Error(`AgentBuilder API error: ${data.error.message}`);
    }

    const content = data.content?.find((c) => c.type === "text");
    if (!content?.text) {
      throw new Error("No text content in agent builder API response");
    }

    return content.text;
  }

  private async callOpenAICompatible(prompt: string): Promise<string> {
    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`AgentBuilder API error ${response.status}: ${text}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message: string };
    };

    if (data.error) {
      throw new Error(`AgentBuilder API error: ${data.error.message}`);
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("No text content in agent builder API response");
    }

    return content;
  }
}
