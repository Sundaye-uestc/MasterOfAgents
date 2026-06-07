import { exec } from "node:child_process";

// ── Types ─────────────────────────────────────────────────────────

export interface CliStatus {
  available: boolean;
  path?: string;
  version?: string;
}

export interface AgentAvailability {
  claude: boolean;
  codex: boolean;
  opencode: boolean;
}

// ── Detection ─────────────────────────────────────────────────────

/**
 * Check whether the Claude Code CLI (`claude`) is available on this machine.
 *
 * Strategy (per design §4): run `claude --version`. If it succeeds,
 * Claude Code is available. We then report all agent types as available
 * (codex, opencode) because a machine with Claude Code installed is
 * assumed to be a capable development environment.
 */
export function detectClaudeCode(): Promise<CliStatus> {
  return new Promise((resolve) => {
    exec("claude --version", { timeout: 10_000 }, (err, stdout) => {
      if (err) {
        resolve({ available: false });
        return;
      }
      resolve({
        available: true,
        path: "claude",
        version: stdout.trim(),
      });
    });
  });
}

export async function getAgentAvailability(): Promise<AgentAvailability> {
  const claude = await detectClaudeCode();
  return {
    claude: claude.available,
    codex: claude.available,
    opencode: claude.available,
  };
}
