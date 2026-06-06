import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";

// pnpm doesn't link chart.js into pptxviewjs's scope because it's
// marked optional in peerDependenciesMeta. Find the real path so
// we can alias it for both dev and production builds.
const chartJsAuto = path.resolve(
  __dirname,
  "../../node_modules/.pnpm/chart.js@4.5.1/node_modules/chart.js/auto/auto.js",
);

const SHARED_ASSETS = path.resolve(__dirname, "../../shared-assets");

function sharedAssetsPlugin() {
  return {
    name: "shared-assets",
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        const url = new URL(req.url, `http://${req.headers.host}`);
        if (url.pathname.startsWith("/agents/")) {
          const filePath = path.join(SHARED_ASSETS, url.pathname);
          if (existsSync(filePath)) {
            const content = readFileSync(filePath);
            const ext = path.extname(filePath).toLowerCase();
            const mime: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
            res.setHeader("Content-Type", mime[ext] || "application/octet-stream");
            res.end(content);
            return;
          }
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), sharedAssetsPlugin()],
  resolve: {
    alias: {
      "chart.js/auto": chartJsAuto,
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3001",
      "/ws": {
        target: "ws://localhost:3001",
        ws: true,
      },
    },
  },
});
