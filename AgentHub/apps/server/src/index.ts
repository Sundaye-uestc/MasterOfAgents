// ============================================================
// AgentHub Server entry — starts the HTTP server
// ============================================================

import dotenv from "dotenv";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// Load .env from repo root (three levels up from apps/server/src)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "..", "..", "..", "..", ".env");
dotenv.config({ path: envPath });

import "./app.js";

console.log("[AgentHub] Server started");
