import { spawn, ChildProcess } from "node:child_process";
import * as fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { app } from "electron";

// ── State ─────────────────────────────────────────────────────────

let serverProcess: ChildProcess | null = null;
let serverPort: number | null = null;
let serverStatus: "running" | "stopped" | "error" = "stopped";

// ── Port detection ────────────────────────────────────────────────

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    // Listen on both IPv4 and IPv6 loopback to catch port conflicts
    // regardless of which address family the server process will use.
    server.listen(port, "127.0.0.1", () => {
      // Also try IPv6 as a secondary check (EADDRINUSE can happen
      // when the server binds to :: while our check was on 127.0.0.1).
      const v6 = net.createServer();
      v6.once("error", () => {
        server.close();
        resolve(false);
      });
      v6.listen(port, "::1", () => {
        v6.close();
        server.close();
        resolve(true);
      });
    });
  });
}

/** Find a free port starting from `startPort`, scanning upward. */
export async function detectFreePort(startPort = 3001): Promise<number> {
  const from = startPort;
  let port = from;
  while (!(await isPortFree(port))) {
    port++;
    if (port > from + 100) {
      throw new Error(`No free port found in range [${from}..${from + 100}]`);
    }
  }
  return port;
}

// ── Module resolution (packaged app) ──────────────────────────────

/**
 * NODE_PATH for the server child process.
 *
 * electron-builder's asarUnpack extracts node_modules to
 * `app.asar.unpacked/node_modules` on the real filesystem.
 * The child Node process can only read from there — it has
 * no asar fs patch, so it cannot resolve through the asar.
 */
function resolveNodeModulesPath(): string | undefined {
  if (!app.isPackaged) return undefined;

  // __dirname = resources/app.asar/dist/main
  // Go up 3 levels → resources/
  // Then into app.asar.unpacked/node_modules
  return path.join(__dirname, "..", "..", "..", "app.asar.unpacked", "node_modules");
}

/**
 * Create a directory junction so the server's ESM imports can resolve dependencies.
 *
 * The server is an ESM module ("type": "module"). Unlike CJS `require()`,
 * ESM **does not use NODE_PATH** for specifier resolution — it only looks
 * in `node_modules/` directories that are ancestors of the importing file.
 *
 * Since the server lives at `resources/server/index.js` and the real
 * node_modules is at `resources/app.asar.unpacked/node_modules/`, we
 * bridge them with a directory junction.
 *
 * **Note**: Creating junctions on Windows requires either Administrator
 * privileges or Developer Mode. If the process lacks permission, this
 * is a best-effort fallback — the build script should have already created
 * the junction during packaging (where permissions are available).
 */
function ensureServerNodeModules(
  serverDir: string,
  nodeModulesPath: string,
): void {
  const serverNodeModules = path.join(serverDir, "node_modules");

  try {
    const stat = fs.lstatSync(serverNodeModules);
    if (stat.isSymbolicLink()) return; // already a junction — done
    if (stat.isDirectory()) {
      fs.rmSync(serverNodeModules, { recursive: true });
    }
  } catch (err: any) {
    if (err.code !== "ENOENT") {
      console.warn(
        `[AgentHub] Cannot inspect server node_modules: ${err.message}`,
      );
      return; // don't risk crashing the app
    }
    // ENOENT is fine — we'll create the junction below
  }

  try {
    fs.symlinkSync(nodeModulesPath, serverNodeModules, "junction");
    console.log("[AgentHub] Created server node_modules junction");
  } catch (err: any) {
    // Junction creation requires SeCreateSymbolicLinkPrivilege on Windows.
    // If the build script already created the junction, this is fine.
    // If not, the server will fail to start — but we log and continue
    // rather than crashing the entire app.
    console.warn(
      `[AgentHub] Cannot create server node_modules junction: ${err.message}`,
    );
  }
}

// ── Server lifecycle ──────────────────────────────────────────────

export interface ServerInfo {
  port: number;
  url: string;
}

/**
 * Start the `apps/server` Node process on a free port.
 *
 * - Dev  (`--dev`): run TypeScript source via `tsx`.
 * - Prod (no flag): run compiled `index.js` from `serverDir`.
 *
 * Resolves when the server outputs its "REST http://localhost:<port>" line.
 */
export function startServer(serverDir: string): Promise<ServerInfo> {
  if (serverProcess) {
    throw new Error("Server is already running");
  }

  const isDev = process.argv.includes("--dev");
  const nodeModulesPath = resolveNodeModulesPath();

  // In packaged mode, ensure ESM can resolve dependencies through a
  // directory junction (NODE_PATH is ignored by ESM specifier resolution).
  if (nodeModulesPath) {
    ensureServerNodeModules(serverDir, nodeModulesPath);
  }

  return new Promise<ServerInfo>((resolve, reject) => {
    detectFreePort()
      .then((port) => {
        const env: Record<string, string | undefined> = {
          ...process.env,
          PORT: String(port),
        };

        if (nodeModulesPath) {
          // Keep NODE_PATH for any CJS dependencies that still need it
          env["NODE_PATH"] = nodeModulesPath;
        }

        const child = isDev
          ? spawn("npx", ["tsx", "src/index.ts"], {
              cwd: serverDir,
              env,
              stdio: ["ignore", "pipe", "pipe"],
              shell: process.platform === "win32",
            })
          : spawn("node", ["index.js"], {
              cwd: serverDir,
              env,
              stdio: ["ignore", "pipe", "pipe"],
              // On Windows, a GUI app (no console) needs shell:true so
              // cmd.exe resolves PATH and handles process creation.
              shell: process.platform === "win32",
              windowsHide: true,
            });

        let started = false;

        child.stdout?.on("data", (data: Buffer) => {
          const text = data.toString();
          process.stdout.write(`[server] ${text}`);

          if (!started && text.includes("REST http://localhost:")) {
            started = true;
            serverProcess = child;
            serverPort = port;
            serverStatus = "running";
            resolve({ port, url: `http://127.0.0.1:${port}` });
          }
        });

        child.stderr?.on("data", (data: Buffer) => {
          process.stderr.write(`[server:err] ${data.toString()}`);
        });

        child.on("error", (err) => {
          serverStatus = "error";
          if (!started) reject(err);
        });

        child.on("exit", (code) => {
          serverProcess = null;
          serverPort = null;
          serverStatus = "stopped";
          if (!started) {
            reject(
              new Error(`Server exited with code ${code ?? "null"} before ready`),
            );
          }
        });

        // 30-second startup timeout
        setTimeout(() => {
          if (!started) {
            child.kill();
            reject(new Error("Server start timed out (30s)"));
          }
        }, 30_000);
      })
      .catch(reject);
  });
}

/** Gracefully stop the server. Sends SIGTERM, force-kills after 5 s. */
export function stopServer(): Promise<void> {
  if (!serverProcess) {
    serverStatus = "stopped";
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const child = serverProcess!;
    child.on("exit", () => {
      serverProcess = null;
      serverPort = null;
      serverStatus = "stopped";
      resolve();
    });

    child.kill("SIGTERM");

    setTimeout(() => {
      if (serverProcess) {
        serverProcess.kill("SIGKILL");
      }
    }, 5_000);
  });
}

export function getServerStatus(): "running" | "stopped" | "error" {
  return serverStatus;
}

export function getServerPort(): number | null {
  return serverPort;
}
