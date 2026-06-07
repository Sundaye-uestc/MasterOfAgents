import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import { detectFreePort } from "./server-lifecycle";

// ── State ─────────────────────────────────────────────────────────

let proxyServer: http.Server | null = null;
let proxyPort: number | null = null;
let backendPort: number | null = null;

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
};

function mimeOf(fp: string): string {
  return MIME[path.extname(fp).toLowerCase()] ?? "application/octet-stream";
}

// ── HTTP proxy helper ─────────────────────────────────────────────

function proxyApi(req: http.IncomingMessage, res: http.ServerResponse): void {
  const opts: http.RequestOptions = {
    hostname: "127.0.0.1",
    port: backendPort,
    path: req.url,
    method: req.method,
    headers: { ...req.headers },
  };

  const proxied = http.request(opts, (backendRes) => {
    res.writeHead(backendRes.statusCode ?? 200, backendRes.headers);
    backendRes.pipe(res);
  });

  proxied.on("error", () => {
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "text/plain" });
    }
    res.end("Bad Gateway");
  });

  req.pipe(proxied);
}

// ── WebSocket proxy helper ────────────────────────────────────────

function proxyWs(
  req: http.IncomingMessage,
  clientSocket: import("node:stream").Duplex,
  head: Buffer,
): void {
  const backendSocket = new (require("node:net").Socket)();

  backendSocket.connect(backendPort!, "127.0.0.1", () => {
    // Forward the upgrade request to the backend
    const headers = Object.entries(req.headers)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\r\n");

    backendSocket.write(
      `${req.method} ${req.url} HTTP/1.1\r\n${headers}\r\n\r\n`,
    );
    backendSocket.write(head);

    // Bidirectional pipe
    clientSocket.pipe(backendSocket);
    backendSocket.pipe(clientSocket);
  });

  backendSocket.on("error", () => {
    clientSocket.destroy();
  });

  clientSocket.on("error", () => {
    backendSocket.destroy();
  });
}

// ── Static file serving + SPA fallback ────────────────────────────

function serveStatic(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  webRoot: string,
): void {
  // Security: normalize URL, prevent directory traversal
  const urlPath = (req.url ?? "/").replace(/\?.*$/, "").replace(/#.*$/, "");
  const safeRel = path.normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const fullPath = path.join(webRoot, safeRel);

  if (!fullPath.startsWith(path.resolve(webRoot))) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("Forbidden");
    return;
  }

  // Try exact file first
  fs.stat(fullPath, (statErr, stat) => {
    if (!statErr && stat.isFile()) {
      serveFile(fullPath, res);
      return;
    }

    // Try index.html in directory
    const indexPath = path.join(fullPath, "index.html");
    fs.stat(indexPath, (idxErr, idxStat) => {
      if (!idxErr && idxStat.isFile()) {
        serveFile(indexPath, res);
        return;
      }

      // SPA fallback: serve root index.html
      const rootIndex = path.join(webRoot, "index.html");
      fs.stat(rootIndex, (rootErr) => {
        if (!rootErr) {
          serveFile(rootIndex, res);
        } else {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not found");
        }
      });
    });
  });
}

function serveFile(filePath: string, res: http.ServerResponse): void {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal error");
      return;
    }
    res.writeHead(200, { "Content-Type": mimeOf(filePath) });
    res.end(data);
  });
}

// ── Lifecycle ─────────────────────────────────────────────────────

export interface ProxyInfo {
  port: number;
  url: string;
}

/**
 * Start the unified production HTTP server.
 *
 * Routes:
 *   /api/*  → reverse proxy to local backend (port `backendPort`)
 *   /ws     → WebSocket proxy to local backend
 *   /*      → static files from `webRoot` with SPA fallback
 *
 * Only binds 127.0.0.1 — accessible only from this machine.
 */
export function startProxyServer(
  webRoot: string,
  backendPortParam: number,
): Promise<ProxyInfo> {
  if (proxyServer) {
    throw new Error("Proxy server is already running");
  }

  backendPort = backendPortParam;

  return detectFreePort(5173).then((port) => {
    return new Promise<ProxyInfo>((resolve, reject) => {
      const server = http.createServer(
        (req: http.IncomingMessage, res: http.ServerResponse) => {
          const url = req.url ?? "/";

          if (url.startsWith("/api/")) {
            proxyApi(req, res);
          } else if (url === "/ws" || url.startsWith("/ws?")) {
            // WebSocket upgrade is handled by the "upgrade" event below.
            // Non-upgrade requests to /ws get a 426.
            res.writeHead(426, { "Content-Type": "text/plain" });
            res.end("Upgrade Required");
          } else {
            serveStatic(req, res, webRoot);
          }
        },
      );

      // Handle WebSocket upgrades
      server.on("upgrade", (req, socket, head) => {
        const url = req.url ?? "/";
        if (url === "/ws" || url.startsWith("/ws?")) {
          proxyWs(req, socket, head);
        } else {
          socket.destroy();
        }
      });

      server.listen(port, "127.0.0.1", () => {
        proxyServer = server;
        proxyPort = port;
        resolve({ port, url: `http://127.0.0.1:${port}` });
      });

      server.on("error", reject);
    });
  });
}

export function stopProxyServer(): Promise<void> {
  if (!proxyServer) return Promise.resolve();

  return new Promise((resolve) => {
    proxyServer!.close(() => {
      proxyServer = null;
      proxyPort = null;
      backendPort = null;
      resolve();
    });
  });
}
