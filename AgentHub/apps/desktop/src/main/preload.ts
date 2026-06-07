import { contextBridge, ipcRenderer } from "electron";

/**
 * Desktop API exposed to the Renderer (Web UI) via contextBridge.
 *
 * Each method maps to an IPC handler registered in ipc-handlers.ts.
 * The Web UI calls `window.desktopApi.<method>()` to access native
 * capabilities (file dialogs, notifications, secure storage, etc.).
 *
 * MVP scope: API shell defined. Handlers are wired in subsequent steps.
 */
contextBridge.exposeInMainWorld("desktopApi", {
  /** The OS platform string (e.g. "win32", "darwin", "linux") */
  platform: process.platform,

  // ── Workspace (Step 3) ──────────────────────────────────────────
  /** Open native folder picker, return selected path or null */
  selectWorkspace: (): Promise<string | null> =>
    ipcRenderer.invoke("desktop:select-workspace"),

  // ── Server Lifecycle (Step 2) ───────────────────────────────────
  /** Get local backend server status */
  getServerStatus: (): Promise<"running" | "stopped" | "error"> =>
    ipcRenderer.invoke("desktop:get-server-status"),

  // ── CLI Detection (Step 5) ──────────────────────────────────────
  /** Get Claude Code CLI availability */
  getCliStatus: (): Promise<{
    claude: boolean;
    codex: boolean;
    opencode: boolean;
  }> => ipcRenderer.invoke("desktop:get-cli-status"),

  // ── Notifications (Step 7) ──────────────────────────────────────
  showNotification: (opts: {
    title: string;
    body: string;
  }): Promise<void> => ipcRenderer.invoke("desktop:show-notification", opts),

  // ── Preview Server (Step 8) ─────────────────────────────────────
  startPreviewServer: (
    workspacePath: string,
    port?: number,
  ): Promise<{ port: number; url: string }> =>
    ipcRenderer.invoke("desktop:start-preview-server", workspacePath, port),
  stopPreviewServer: (): Promise<void> =>
    ipcRenderer.invoke("desktop:stop-preview-server"),
  getPreviewUrl: (relativePath: string): Promise<string | null> =>
    ipcRenderer.invoke("desktop:get-preview-url", relativePath),
});
