import { Notification, BrowserWindow } from "electron";

export interface NotificationInput {
  title: string;
  body: string;
  /** "critical" maps to system-level urgent delivery (macOS entitlements required). */
  urgency?: "normal" | "critical";
}

/**
 * Show a system-level desktop notification via Electron.
 *
 * Covers the 4 scenarios from design §2.3:
 *   1. Agent run completed / failed
 *   2. Permission approval request received
 *   3. High-risk operation warning
 *   4. Long-silence recovery
 *
 * On click, the main BrowserWindow is restored and focused so the user
 * lands directly in the relevant view.
 */
export function showNotification(input: NotificationInput): void {
  if (!Notification.isSupported()) {
    console.warn("[AgentHub Desktop] Notifications not supported on this system");
    return;
  }

  const win = BrowserWindow.getAllWindows()[0];

  const notification = new Notification({
    title: input.title,
    body: input.body,
    urgency: input.urgency ?? "normal",
  });

  notification.on("click", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  notification.show();
}
