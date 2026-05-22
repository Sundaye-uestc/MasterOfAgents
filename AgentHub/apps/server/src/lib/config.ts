// ============================================================
// Environment configuration
// ============================================================

type AiProvider = "anthropic" | "dashscope" | "deepseek" | "dobrain" | "moonshot" | "openai" | "openrouter" | "glm";

const PROVIDER_CONFIGS: Record<AiProvider, { endpoint: string; keyEnv: string; defaultModel: string; format: "anthropic" | "openai" }> = {
  anthropic: {
    endpoint: "https://api.anthropic.com/v1/messages",
    keyEnv: "ANTHROPIC_API_KEY",
    defaultModel: "claude-sonnet-4-6-20250514",
    format: "anthropic",
  },
  dashscope: {
    endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    keyEnv: "DASHSCOPE_API_KEY",
    defaultModel: "qwen-max",
    format: "openai",
  },
  deepseek: {
    endpoint: "https://api.deepseek.com/v1/chat/completions",
    keyEnv: "DEEPSEEK_API_KEY",
    defaultModel: "deepseek-chat",
    format: "openai",
  },
  dobrain: {
    endpoint: "https://api.dobrain.com/v1/chat/completions",
    keyEnv: "DOBRAIN_API_KEY",
    defaultModel: "dobrain-v1",
    format: "openai",
  },
  moonshot: {
    endpoint: "https://api.moonshot.cn/v1/chat/completions",
    keyEnv: "MOONSHOT_API_KEY",
    defaultModel: "moonshot-v1-8k",
    format: "openai",
  },
  openai: {
    endpoint: "https://api.openai.com/v1/chat/completions",
    keyEnv: "OPENAI_API_KEY",
    defaultModel: "gpt-4o",
    format: "openai",
  },
  openrouter: {
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    keyEnv: "OPENROUTER_API_KEY",
    defaultModel: "anthropic/claude-sonnet-4",
    format: "openai",
  },
  glm: {
    endpoint: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    keyEnv: "GLM_API_KEY",
    defaultModel: "glm-4-plus",
    format: "openai",
  },
};

const provider: AiProvider = (process.env["PLANNER_PROVIDER"] ?? "anthropic") as AiProvider;
const providerCfg = PROVIDER_CONFIGS[provider] ?? PROVIDER_CONFIGS.anthropic;

function resolveApiKey(): string {
  // Try provider-specific key first, then fallback to generic keys
  const keys = [providerCfg.keyEnv, "PLANNER_API_KEY", "ANTHROPIC_API_KEY"];
  for (const k of keys) {
    const v = process.env[k];
    if (v && v.length > 10 && !v.startsWith("sk-ant-...") && !v.startsWith("your-")) return v;
  }
  return "";
}

export const config = {
  plannerProvider: provider,
  plannerApiUrl: process.env["PLANNER_API_URL"] ?? providerCfg.endpoint,
  plannerModel: process.env["PLANNER_MODEL"] ?? providerCfg.defaultModel,
  plannerApiKey: resolveApiKey(),
  plannerApiFormat: providerCfg.format as "anthropic" | "openai",
};
