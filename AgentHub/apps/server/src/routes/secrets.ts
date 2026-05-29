// ============================================================
// Secrets Routes — CRUD for encrypted secrets
// ============================================================

import { Hono } from "hono";
import { SecurityService } from "../services/security.service.js";

const svc = new SecurityService();
export const secretRoutes = new Hono();

// --- List secrets (names only, no decrypted values) ---
secretRoutes.get("/", async (c) => {
  const secrets = await svc.listSecrets();
  return c.json(secrets.map((s) => ({
    id: s.id,
    name: s.name,
    provider: s.provider,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  })));
});

// --- Create secret ---
secretRoutes.post("/", async (c) => {
  const body = await c.req.json<{ name: string; value: string; provider?: string }>();
  if (!body.name || !body.value) {
    return c.json({ error: "name and value are required" }, 400);
  }
  const secret = await svc.createSecret(body.name, body.value, body.provider);
  return c.json({ id: secret.id, name: secret.name, provider: secret.provider, createdAt: secret.createdAt }, 201);
});

// --- Delete secret ---
secretRoutes.delete("/:id", async (c) => {
  const ok = await svc.deleteSecret(c.req.param("id")!);
  if (!ok) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});