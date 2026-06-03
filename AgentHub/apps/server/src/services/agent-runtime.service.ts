// ============================================================
// AgentRuntimeService — Agent adapter lifecycle & run management
// ============================================================

import { ClaudeCodeAdapter } from "../adapters/claude-code.adapter.js";
import { CodexAdapter } from "../adapters/codex.adapter.js";
import type { AgentPlatformAdapter } from "../adapters/base.js";
import type { AgentEvent, AgentConfig } from "@agenthub/shared";
import { getDb, schema } from "../db/index.js";
import { eq } from "drizzle-orm";
import { newId, nowISO } from "../lib/ids.js";
import type { ChatService } from "./chat.service.js";
import { WorkspaceService } from "./workspace.service.js";
import { ArtifactService } from "./artifact.service.js";
import { broadcastToConversation } from "../ws/gateway.js";
import { crashLog } from "../lib/crash-log.js";
import * as path from "node:path";

let singleton: AgentRuntimeService | null = null;

export function getAgentRuntimeService(): AgentRuntimeService {
  if (!singleton) {
    singleton = new AgentRuntimeService();
  }
  return singleton;
}

export class AgentRuntimeService {
  private adapters = new Map<string, AgentPlatformAdapter>();
  private activeRuns = new Map<string, AbortController>();
  private abortedRuns = new Set<string>();
  private runAdapterMap = new Map<string, string>(); // runId -> agentConfigId

  async getAdapter(agentConfig: AgentConfig): Promise<AgentPlatformAdapter> {
    const key = agentConfig.id;
    let adapter = this.adapters.get(key);
    if (!adapter) {
      const kind = agentConfig.platform ?? "claude-code";
      // Try CodexAdapter only if codex/opencode CLI is available; fallback to ClaudeCodeAdapter
      if (kind === "codex" || kind === "opencode") {
        adapter = new CodexAdapter({ platform: kind });
        try {
          await adapter.prepare(agentConfig);
        } catch (err) {
          console.warn(`[runtime] CodexAdapter prepare failed (${(err as Error).message}), falling back to ClaudeCodeAdapter`);
          adapter = new ClaudeCodeAdapter();
          await adapter.prepare(agentConfig);
        }
      } else {
        adapter = new ClaudeCodeAdapter();
        await adapter.prepare(agentConfig);
      }
      this.adapters.set(key, adapter);
    }
    return adapter;
  }

  /** Start a direct (1v1) run for a conversation */
  async startDirectRun(params: {
    conversationId: string;
    agentId: string;
    agentConfig: AgentConfig;
    prompt: string;
    systemPrompt?: string;
    triggerMessageId?: string;
    chatService: ChatService;
    onEvent: (event: AgentEvent, messageId: string) => void;
  }): Promise<{ runId: string; agentMessageId: string }> {
    const { conversationId, agentId, agentConfig, prompt, systemPrompt, triggerMessageId, chatService, onEvent } = params;

    // Build conversation history for short-term memory context
    let messageHistory: Array<{ role: "user" | "agent" | "system"; content: string }> | undefined;
    try {
      messageHistory = await chatService.buildAgentContext(conversationId);
    } catch (err) {
      console.warn(`[runtime] Failed to build agent context: ${(err as Error).message}`);
    }

    // Create run record
    const runId = newId();
    const now = nowISO();
    const db = getDb();

    db.insert(schema.runs).values({
      id: runId,
      conversationId,
      triggerMessageId: triggerMessageId ?? null,
      mode: "direct",
      status: "running",
      startedAt: now,
      createdAt: now,
    }).run();

    // Create agent message placeholder (streaming so WS message:created shows "思考中")
    const agentMsg = await chatService.createMessage({
      conversationId,
      role: "agent",
      content: "",
      agentId,
      runId,
      status: "streaming",
    });

    const abortController = new AbortController();
    this.activeRuns.set(runId, abortController);

    const adapter = await this.getAdapter(agentConfig);
    this.runAdapterMap.set(runId, agentConfig.id);

    const workspaceSvc = new WorkspaceService();

    // Run async — stream events back through callback
    (async () => {
      crashLog(`IIFE START run=${runId.slice(0, 8)}`);
      let beforeSnapshotId: string | null = null;

      // Ensure workspace exists BEFORE the run so we can use it as workingDir
      let workspaceRoot: string | null = null;
      try {
        const ws = await workspaceSvc.ensureWorkspace(conversationId);
        workspaceRoot = ws.rootPath;
        crashLog(`Workspace ready: ${workspaceRoot}`);
        const beforeManifest = workspaceSvc.generateManifest(ws.rootPath);
        crashLog(`Manifest: ${Object.keys(beforeManifest).length} files`);
        const beforeSnap = await workspaceSvc.createSnapshot(ws.id, runId, "before", beforeManifest);
        beforeSnapshotId = beforeSnap.id;
        crashLog(`Before snapshot: ${beforeSnapshotId.slice(0, 8)}`);
      } catch (snapErr) {
        crashLog(`Before snapshot FAILED: ${(snapErr as Error).message}`);
        console.warn(`[runtime] Failed to create before snapshot: ${(snapErr as Error).message}`, snapErr);
      }

      try {
        crashLog(`Calling adapter.run()...`);
        const stream = adapter.run({
          runId,
          agentId,
          prompt,
          systemPrompt,
          messageHistory,
          workingDir: workspaceRoot ?? process.cwd(),

          signal: abortController.signal,
        });

        // Defer run_completed until AFTER diffSnapshots, so the frontend
        // always sees file changes when it calls load() on run:completed.
        let deferredCompletedEvent: AgentEvent | null = null;
        let eventCount = 0;

        crashLog(`Stream loop START`);
        for await (const event of stream) {
          eventCount++;
          crashLog(`Event #${eventCount}: type=${event.type}`);
          // Defer run_completed / run_failed until after snapshot diffing
          if (event.type === "run_completed" || event.type === "run_failed") {
            crashLog(`Deferring ${event.type} (count=${eventCount})`);
            deferredCompletedEvent = event;
            continue;
          }

          onEvent(event, agentMsg.id);

          // Persist tool invocations
          if (event.type === "tool_call") {
            db.insert(schema.toolInvocations).values({
              id: event.toolCallId || newId(),
              runId,
              agentId,
              toolName: event.toolName,
              inputJson: JSON.stringify(event.input),
              status: "running",
              startedAt: nowISO(),
            }).run();
          }

          // Persist tool results
          if (event.type === "tool_result") {
            db.update(schema.toolInvocations)
              .set({
                outputJson: event.output,
                status: event.isError ? "error" : "success",
                completedAt: nowISO(),
              } as any)
              .where(eq(schema.toolInvocations.id, event.toolCallId))
              .run();
          }

          // file_change events are NOT persisted here — diffSnapshots
          // (run after the stream completes) is the single source of truth
          // for FileChange records. This avoids duplicate entries caused by
          // streaming file_change events + diffSnapshots inserting the same changes.
        }

        crashLog(`Stream loop END (${eventCount} events, deferred=${deferredCompletedEvent ? deferredCompletedEvent.type : 'NONE'})`);

        // --- Create after snapshot + diff ---
        try {
          const ws = await workspaceSvc.ensureWorkspace(conversationId);
          const afterManifest = workspaceSvc.generateManifest(ws.rootPath);
          const afterSnap = await workspaceSvc.createSnapshot(ws.id, runId, "after", afterManifest);
          if (beforeSnapshotId) {
            crashLog(`Diffing snapshots before=${beforeSnapshotId.slice(0,8)} after=${afterSnap.id.slice(0,8)}`);
            const changes = await workspaceSvc.diffSnapshots(beforeSnapshotId, afterSnap.id);
            crashLog(`diffSnapshots: ${changes.length} changes: ${changes.map(c => `${c.changeType}:${c.path}`).join(', ') || '(none)'}`);

            // Helper: check if a path is a PPT output internal file
            // (slide images, prompts.json, slides_plan.json, etc.)
            // These are already represented by the index.html viewer or .pptx file,
            // so we skip them to avoid flooding the chat UI.
            const isPptInternal = (filePath: string): boolean => {
              const normalized = filePath.replace(/\\/g, "/");
              if (/\/images\/slide-\d+\.(png|jpg|jpeg|webp)$/i.test(normalized)) return true;
              if (/\/(prompts|slides_plan)\.json$/i.test(normalized)) return true;
              return false;
            };

            // Broadcast each file change so the frontend updates in real-time
            for (const fc of changes) {
              if (isPptInternal(fc.path)) {
                crashLog(`file:changed skipped (PPT internal): ${fc.path}`);
                continue;
              }
              crashLog(`Broadcast file:changed ${fc.changeType}:${fc.path}`);
              broadcastToConversation(conversationId, {
                type: "file:changed",
                change: fc,
                conversationId,
              });
            }

            // --- Create artifacts from file changes for inline display ---
            if (changes.length > 0) {
              const artifactSvc = new ArtifactService();

              for (const fc of changes) {
                if (fc.changeType === "delete") continue;
                // Skip PPT internal files — the index.html viewer covers the slides
                if (isPptInternal(fc.path)) {
                  crashLog(`Artifact skipped (PPT internal): ${fc.path}`);
                  continue;
                }
                const ext = path.extname(fc.path).toLowerCase();
                let artifactType: "file" | "webpage" | "diff" | "archive" = "file";
                let mimeType = "application/octet-stream";

                if (ext === ".html" || ext === ".htm") {
                  artifactType = "webpage";
                  mimeType = "text/html";
                } else if (ext === ".css") {
                  mimeType = "text/css";
                } else if ([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx"].includes(ext)) {
                  mimeType = ext === ".ts" || ext === ".tsx" ? "text/typescript" : "application/javascript";
                } else if (ext === ".json") {
                  mimeType = "application/json";
                } else if ([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"].includes(ext)) {
                  mimeType = `image/${ext === ".jpg" ? "jpeg" : ext === ".svg" ? "svg+xml" : ext.slice(1)}`;
                } else if (ext === ".pdf") {
                  mimeType = "application/pdf";
                } else if ([".md", ".txt", ".xml", ".yaml", ".yml", ".csv", ".log"].includes(ext)) {
                  mimeType = "text/plain";
                } else if ([".py", ".pyw"].includes(ext)) {
                  mimeType = "text/x-python";
                } else if (ext === ".java") {
                  mimeType = "text/x-java";
                } else if (ext === ".go") {
                  mimeType = "text/x-go";
                } else if (ext === ".rs") {
                  mimeType = "text/x-rust";
                } else if ([".c", ".h"].includes(ext)) {
                  mimeType = "text/x-c";
                } else if ([".cpp", ".cxx", ".hpp", ".hxx", ".cc"].includes(ext)) {
                  mimeType = "text/x-c++";
                } else if ([".sh", ".bash", ".zsh"].includes(ext)) {
                  mimeType = "text/x-shellscript";
                } else if (ext === ".rb") {
                  mimeType = "text/x-ruby";
                } else if (ext === ".php") {
                  mimeType = "text/x-php";
                } else if (ext === ".swift") {
                  mimeType = "text/x-swift";
                } else if ([".kt", ".kts"].includes(ext)) {
                  mimeType = "text/x-kotlin";
                } else if (ext === ".scala") {
                  mimeType = "text/x-scala";
                } else if (ext === ".r") {
                  mimeType = "text/x-r";
                } else if (ext === ".sql") {
                  mimeType = "text/x-sql";
                } else if (ext === ".lua") {
                  mimeType = "text/x-lua";
                } else if (ext === ".toml") {
                  mimeType = "text/x-toml";
                } else if ([".ini", ".cfg", ".conf", ".env"].includes(ext)) {
                  mimeType = "text/plain";
                } else if ([".vue", ".svelte"].includes(ext)) {
                  mimeType = "text/html";
                } else if ([".pptx", ".ppt"].includes(ext)) {
                  mimeType = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
                } else {
                  // Fallback: treat unrecognized extensions as plain text
                  // (agent-created files are virtually always text-based)
                  mimeType = "text/plain";
                }

                try {
                  const art = await artifactSvc.createArtifact({
                    runId,
                    messageId: agentMsg.id,
                    type: artifactType,
                    name: fc.path.split("/").pop() || fc.path,
                    filePath: fc.path,
                    mimeType,
                    rootPath: ws.rootPath,
                    metadata: { changeType: fc.changeType },
                  });

                  broadcastToConversation(conversationId, {
                    type: "artifact:created",
                    artifact: art,
                  } as any);

                  crashLog(`Artifact created: ${art.id.slice(0, 8)} ${artifactType}:${fc.path}`);
                } catch (artErr) {
                  crashLog(`Artifact creation FAILED for ${fc.path}: ${(artErr as Error).message}`);
                }
              }
            }
          } else {
            crashLog(`No beforeSnapshotId — skipping diffSnapshots`);
          }
        } catch (snapErr) {
          crashLog(`After snapshot FAILED: ${(snapErr as Error).message}`);
        }

        // --- Now emit the completion event ---
        // This MUST happen after diffSnapshots so the frontend's load() HTTP
        // request always finds file changes in the DB.
        //
        // If the stream never produced a run_completed/run_failed (edge case:
        // CLI crash, stream-json format change, etc.), emit a synthetic
        // run_completed so the frontend always transitions out of "thinking".
        if (deferredCompletedEvent) {
          crashLog(`Emitting deferred ${deferredCompletedEvent.type}`);
          onEvent(deferredCompletedEvent, agentMsg.id);
        } else {
          crashLog(`No completion event — emitting synthetic`);
          onEvent({
            type: "run_completed",
            runId,
            summary: "Agent finished (stream ended without explicit completion)",
            timestamp: Date.now(),
          } as AgentEvent, agentMsg.id);
        }

        // Mark completed only if run was not aborted externally
        if (this.activeRuns.has(runId)) {
          crashLog(`Marking run completed + updating message status`);
          db.update(schema.runs)
            .set({ status: "completed", completedAt: nowISO() } as any)
            .where(eq(schema.runs.id, runId))
            .run();
          await chatService.updateMessageStatus(agentMsg.id, "sent");
          crashLog(`Run completed — message status updated`);
        } else {
          // Run was aborted — overwrite content and mark as error
          await chatService.setContent(agentMsg.id, "");
          db.update(schema.runs)
            .set({ status: "failed", errorJson: JSON.stringify({ message: "Run aborted by user" }), completedAt: nowISO() } as any)
            .where(eq(schema.runs.id, runId))
            .run();
          await chatService.updateMessageStatus(agentMsg.id, "error");
          this.abortedRuns.delete(runId);
        }
      } catch (err) {
        crashLog(`IIFE CATCH: ${err instanceof Error ? err.message : String(err)}`);
        console.error(`[runtime] ❌ Stream/run error for run=${runId.slice(0, 8)}:`, err);
        const errorMsg = err instanceof Error ? err.message : String(err);
        db.update(schema.runs)
          .set({ status: "failed", errorJson: JSON.stringify({ message: errorMsg }), completedAt: nowISO() } as any)
          .where(eq(schema.runs.id, runId))
          .run();

        await chatService.updateMessageStatus(agentMsg.id, "error");
      } finally {
        crashLog(`IIFE FINALLY — deleting active run`);
        this.activeRuns.delete(runId);
        crashLog(`IIFE END`);
      }
    })();

    return { runId, agentMessageId: agentMsg.id };
  }

  isRunAborted(runId: string): boolean {
    return this.abortedRuns.has(runId);
  }

  async handlePermissionResponse(runId: string, permissionId: string, approved: boolean): Promise<void> {
    const agentConfigId = this.runAdapterMap.get(runId);
    if (!agentConfigId) {
      console.warn(`[runtime] no adapter mapping for run ${runId}`);
      return;
    }
    const adapter = this.adapters.get(agentConfigId);
    if (!adapter) {
      console.warn(`[runtime] adapter not found for ${agentConfigId}`);
      return;
    }
    // Call respondToPermission if the adapter supports it
    if ("respondToPermission" in adapter && typeof (adapter as any).respondToPermission === "function") {
      (adapter as any).respondToPermission(runId, permissionId, approved ? "allow" : "deny");
    }
  }

  async stopRun(runId: string): Promise<void> {
    this.abortedRuns.add(runId);
    const controller = this.activeRuns.get(runId);
    if (controller) {
      controller.abort();
      this.activeRuns.delete(runId);
    }
  }

  async getActiveRuns(): Promise<string[]> {
    return Array.from(this.activeRuns.keys());
  }

  async dispose(): Promise<void> {
    for (const [runId, controller] of this.activeRuns) {
      controller.abort();
    }
    this.activeRuns.clear();
    for (const adapter of this.adapters.values()) {
      await adapter.dispose();
    }
    this.adapters.clear();
  }
}
