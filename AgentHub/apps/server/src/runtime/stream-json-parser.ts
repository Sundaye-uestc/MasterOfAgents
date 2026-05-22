// ============================================================
// Stream JSON Parser
// Parses Claude Code CLI `--output-format stream-json` output
// into normalized AgentEvent types.
// ============================================================

import { AgentEvent } from "@agenthub/shared";

/** Schema of a Claude Code CLI stream-json line (simplified) */
interface ClaudeStreamLine {
  type: string;
  message?: {
    id?: string;
    content?: Array<{ type: string; text?: string; tool_use?: ClaudeToolUse; tool_result?: ClaudeToolResult }>;
    usage?: { input_tokens: number; output_tokens: number };
  };
  result?: string;
  error?: string;
  tool_use?: ClaudeToolUse;
  tool_result?: ClaudeToolResult;
}

interface ClaudeToolUse {
  id?: string;
  name: string;
  input: Record<string, unknown>;
}

interface ClaudeToolResult {
  tool_use_id?: string;
  content?: string;
  is_error?: boolean;
}

/**
 * Convert a raw stdout line from Claude CLI into zero or more AgentEvent.
 * Returns null for lines that don't produce events (e.g., empty lines).
 */
export function parseStreamLine(line: string, runId: string, _agentId: string): AgentEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let parsed: ClaudeStreamLine;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    // Non-JSON line (e.g., stderr noise) — treat as log
    return {
      type: "log",
      runId,
      level: "warn",
      message: trimmed,
      timestamp: Date.now(),
    };
  }

  const ts = Date.now();

  switch (parsed.type) {
    case "system":
      // System init events — log them
      return {
        type: "log",
        runId,
        level: "info",
        message: `System: ${JSON.stringify(parsed)}`,
        timestamp: ts,
      };

    case "assistant": {
      // Extract content blocks from assistant message
      const contents = parsed.message?.content ?? [];

      for (const block of contents) {
        if (block.type === "text" && block.text) {
          return {
            type: "text_delta",
            runId,
            delta: block.text,
            timestamp: ts,
          };
        }
        if (block.type === "tool_use" && block.tool_use) {
          return {
            type: "tool_call",
            runId,
            toolCallId: block.tool_use.id ?? crypto.randomUUID(),
            toolName: block.tool_use.name,
            input: block.tool_use.input,
            timestamp: ts,
          };
        }
      }
      return null;
    }

    case "user": {
      // Tool results come back as user messages in Claude CLI
      const contents = parsed.message?.content ?? [];
      for (const block of contents) {
        if (block.type === "tool_result" && block.tool_result) {
          return {
            type: "tool_result",
            runId,
            toolCallId: block.tool_result.tool_use_id ?? "",
            toolName: "",
            output: block.tool_result.content ?? "",
            isError: block.tool_result.is_error,
            timestamp: ts,
          };
        }
      }
      return null;
    }

    case "result":
      // Final result from CLI
      return {
        type: "run_completed",
        runId,
        summary: parsed.result ?? "Run completed",
        timestamp: ts,
      };

    case "error":
      return {
        type: "run_failed",
        runId,
        error: parsed.error ?? "Unknown error",
        timestamp: ts,
      };

    default:
      return {
        type: "log",
        runId,
        level: "info",
        message: trimmed,
        timestamp: ts,
      };
  }
}

/**
 * Check if a line is a "done" signal from the stream.
 * Claude CLI sends a special end-of-stream marker.
 */
export function isStreamComplete(line: string): boolean {
  try {
    const parsed = JSON.parse(line.trim());
    return parsed.type === "result";
  } catch {
    return false;
  }
}
