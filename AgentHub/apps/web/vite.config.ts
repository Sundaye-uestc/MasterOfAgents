import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// pnpm doesn't link chart.js into pptxviewjs's scope because it's
// marked optional in peerDependenciesMeta. Find the real path so
// we can alias it for both dev and production builds.
const chartJsAuto = path.resolve(
  __dirname,
  "../../node_modules/.pnpm/chart.js@4.5.1/node_modules/chart.js/auto/auto.js",
);

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
