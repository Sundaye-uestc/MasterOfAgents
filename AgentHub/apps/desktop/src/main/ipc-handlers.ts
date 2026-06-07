import { app, ipcMain, dialog } from "electron";
import * as fs from "node:fs";
import * as path from "node:path";
import { getServerStatus } from "./server-lifecycle";
import { getAgentAvailability } from "./cli-detection";
import { showNotification } from "./notification";
import {
  startPreviewServer,
  stopPreviewServer as stopPreview,
  getPreviewUrl,
} from "./preview-server";

const RECENT_WORKSPACE_KEY = "recent-workspace.json";

// ── Helpers ───────────────────────────────────────────────────────

function recentWorkspacePath(): string {
  return path.join(app.getPath("userData"), RECENT_WORKSPACE_KEY);
}

function loadRecentWorkspace(): string | null {
  try {
    const file = recentWorkspacePath();
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, "utf-8")).path || null;
    }
  } catch {
    /* corrupt or missing — ignore */
  }
  return null;
}

function saveRecentWorkspace(workspacePath: string): void {
  try {
    fs.writeFileSync(
      recentWorkspacePath(),
      JSON.stringify({ path: workspacePath, updatedAt: Date.now() }),
    );
  } catch {
    /* permission issue — ignore */
  }
}

// ── Registration ──────────────────────────────────────────────────

export function registerIpcHandlers(): void {
  // ── Workspace selection ──────────────────────────────────────
  ipcMain.handle("desktop:select-workspace", async () => {
    const recent = loadRecentWorkspace();

    const result = await dialog.showOpenDialog({
      title: "选择工作区",
      properties: ["openDirectory"],
      defaultPath: recent || app.getPath("home"),
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const selected = result.filePaths[0]!;
    saveRecentWorkspace(selected);
    return selected;
  });

  // ── Server status ────────────────────────────────────────────
  ipcMain.handle("desktop:get-server-status", () => {
    return getServerStatus();
  });

  // ── CLI status ──────────────────────────────────────────────
  ipcMain.handle("desktop:get-cli-status", () => {
    return getAgentAvailability();
  });

  // ── Notification ────────────────────────────────────────────
  ipcMain.handle(
    "desktop:show-notification",
    (_event, opts: { title: string; body: string }) => {
      showNotification(opts);
    },
  );

  // ── Preview server ───────────────────────────────────────────
  ipcMain.handle(
    "desktop:start-preview-server",
    (_event, workspacePath: string, port?: number) => {
      return startPreviewServer(workspacePath, port);
    },
  );

  ipcMain.handle("desktop:stop-preview-server", () => {
    return stopPreview();
  });

  ipcMain.handle(
    "desktop:get-preview-url",
    (_event, relativePath: string) => {
      return getPreviewUrl(relativePath);
    },
  );
}
