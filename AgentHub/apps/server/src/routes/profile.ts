// ============================================================
// User Profile REST routes — avatar + settings shared across clients
// ============================================================

import { Hono } from "hono";
import { getDb, schema } from "../db/index.js";
import { eq } from "drizzle-orm";
import { nowISO } from "../lib/ids.js";

export const profileRoutes = new Hono();

const PROFILE_ID = "default";

function ensureProfile(db: ReturnType<typeof getDb>): void {
  const existing = db.select().from(schema.userProfile).where(eq(schema.userProfile.id, PROFILE_ID)).get();
  if (!existing) {
    db.insert(schema.userProfile).values({
      id: PROFILE_ID,
      avatar: null,
      updatedAt: nowISO(),
    }).run();
  }
}

// GET /api/profile — return current user profile
profileRoutes.get("/", (c) => {
  const db = getDb();
  ensureProfile(db);
  const profile = db.select().from(schema.userProfile).where(eq(schema.userProfile.id, PROFILE_ID)).get();
  return c.json({ avatar: profile?.avatar ?? null });
});

// PUT /api/profile — update user profile
profileRoutes.put("/", async (c) => {
  const db = getDb();
  ensureProfile(db);
  const body = await c.req.json<{ avatar?: string | null }>();
  const updates: Record<string, unknown> = { updatedAt: nowISO() };
  if (body.avatar !== undefined) updates.avatar = body.avatar;
  db.update(schema.userProfile).set(updates).where(eq(schema.userProfile.id, PROFILE_ID)).run();
  const profile = db.select().from(schema.userProfile).where(eq(schema.userProfile.id, PROFILE_ID)).get();
  return c.json({ avatar: profile?.avatar ?? null });
});
