import { app, BrowserWindow } from "electron";
import path from "node:path";
import { startServer, stopServer } from "./server-lifecycle";
import { startProxyServer, stopProxyServer } from "./proxy-server";
import { registerIpcHandlers } from "./ipc-handlers";
import { stopPreviewServer } from "./preview-server";

const isDev = process.argv.includes("--dev");

app.setAppUserModelId("com.agenthub.desktop");

const SERVER_DIR = app.isPackaged
  ? path.join(process.resourcesPath, "server")
  : path.resolve(__dirname, "../../../server");

const WEB_DIST_DIR = app.isPackaged
  ? path.join(process.resourcesPath, "web")
  : path.resolve(__dirname, "../../../web/dist");

let mainWindow: BrowserWindow | null = null;

async function createMainWindow(): Promise<BrowserWindow> {
  const serverInfo = await startServer(SERVER_DIR);
  console.log(`[AgentHub] Server: ${serverInfo.url}`);

  const uiUrl = isDev
    ? "http://localhost:5173"
    : (await startProxyServer(WEB_DIST_DIR, serverInfo.port)).url;

  console.log(`[AgentHub] UI: ${uiUrl}`);

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "AgentHub",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadURL(uiUrl);

  if (isDev) {
    win.webContents.openDevTools();
  }

  win.on("closed", () => {
    mainWindow = null;
  });

  return win;
}

app.whenReady().then(async () => {
  registerIpcHandlers();

  try {
    mainWindow = await createMainWindow();
  } catch (err: any) {
    console.error("[AgentHub] Failed to start:", err?.message ?? err);
    app.quit();
  }

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      try {
        mainWindow = await createMainWindow();
      } catch (err: any) {
        console.error("[AgentHub] Failed to activate:", err?.message ?? err);
        app.quit();
      }
    }
  });
});

app.on("window-all-closed", () => {
  Promise.allSettled([
    stopServer(),
    stopProxyServer(),
    stopPreviewServer(),
  ]).finally(() => app.quit());
});
