import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";

// ── State ─────────────────────────────────────────────────────────

let server: http.Server | null = null;
let serverPort: number | null = null;
let workspaceRoot: string | null = null;

// ── MIME ──────────────────────────────────────────────────────────

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
  ".pdf": "application/pdf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
  ".xml": "application/xml",
};

function mimeOf(filePath: string): string {
  return MIME[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

// ── Lifecycle ─────────────────────────────────────────────────────

/**
 * Start a lightweight static HTTP file server on `workspacePath`.
 *
 * Only binds `127.0.0.1` — only local processes can reach it.
 * Serves HTML, images, built frontend output, and other Agent artifacts
 * for in-app preview via WebPreviewCard.
 */
export function startPreviewServer(
  workspacePath: string,
  port?: number,
): Promise<{ port: number; url: string }> {
  if (server) {
    throw new Error("Preview server is already running");
  }

  const previewPort = port ?? 4000;

  return new Promise((resolve, reject) => {
    const srv = http.createServer(
      (req: http.IncomingMessage, res: http.ServerResponse) => {
        const rel = req.url ?? "/";
        const fullPath = path.resolve(workspacePath, `.${rel}`);

        // Directory-traversal guard
        if (!fullPath.startsWith(path.resolve(workspacePath))) {
          res.writeHead(403, { "Content-Type": "text/plain" });
          res.end("Forbidden");
          return;
        }

        fs.stat(fullPath, (statErr, stat) => {
          if (statErr) {
            res.writeHead(404, { "Content-Type": "text/plain" });
            res.end("Not found");
            return;
          }

          if (stat.isDirectory()) {
            const indexPath = path.join(fullPath, "index.html");
            fs.readFile(indexPath, (readErr, data) => {
              if (readErr) {
                res.writeHead(404, { "Content-Type": "text/plain" });
                res.end("Not found");
                return;
              }
              res.writeHead(200, { "Content-Type": "text/html" });
              res.end(data);
            });
            return;
          }

          fs.readFile(fullPath, (readErr, data) => {
            if (readErr) {
              res.writeHead(500, { "Content-Type": "text/plain" });
              res.end("Internal error");
              return;
            }
            res.writeHead(200, { "Content-Type": mimeOf(fullPath) });
            res.end(data);
          });
        });
      },
    );

    srv.listen(previewPort, "127.0.0.1", () => {
      server = srv;
      serverPort = previewPort;
      workspaceRoot = workspacePath;
      resolve({ port: previewPort, url: `http://127.0.0.1:${previewPort}` });
    });

    srv.on("error", reject);
  });
}

export function stopPreviewServer(): Promise<void> {
  if (!server) return Promise.resolve();

  return new Promise((resolve) => {
    server!.close(() => {
      server = null;
      serverPort = null;
      workspaceRoot = null;
      resolve();
    });
  });
}

/** Build a full preview URL for a file relative to the workspace root. */
export function getPreviewUrl(relativePath: string): string | null {
  if (serverPort === null) return null;
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\//, "");
  return `http://127.0.0.1:${serverPort}/${normalized}`;
}
