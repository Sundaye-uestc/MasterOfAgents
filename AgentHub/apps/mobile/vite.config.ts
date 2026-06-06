import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";

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
  plugins: [
    react(),
    tailwindcss(),
    sharedAssetsPlugin(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: false,
      workbox: {
        globPatterns: [],
      },
    }),
  ],
  server: {
    port: 5174,
    proxy: {
      "/api": "http://localhost:3001",
      "/ws": {
        target: "ws://localhost:3001",
        ws: true,
      },
    },
  },
});
