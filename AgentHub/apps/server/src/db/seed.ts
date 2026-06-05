// Seed default agents into the database
import { getDb, schema } from "./index.js";
import { eq } from "drizzle-orm";
import { newId, nowISO } from "../lib/ids.js";

const DEFAULT_AGENTS = [
  {
    id: "default-claude",
    name: "Claude Code",
    adapterKind: "claude-code",
    avatar: "/agents/claude-code.png",
    capabilities: ["code-generation", "debugging", "refactoring", "file-management"],
  },
  {
    id: "default-codex",
    name: "Codex",
    adapterKind: "codex",
    avatar: "/agents/codex.png",
    capabilities: ["code-generation", "code-review", "documentation"],
  },
  {
    id: "default-opencode",
    name: "OpenCode",
    adapterKind: "opencode",
    avatar: "/agents/opencode.png",
    capabilities: ["code-generation", "debugging", "refactoring", "code-review"],
  },
];

export function seedAgents() {
  const db = getDb();
  const now = nowISO();

  for (const agent of DEFAULT_AGENTS) {
    const existing = db
      .select()
      .from(schema.agents)
      .where(eq(schema.agents.id, agent.id))
      .get();

    if (!existing) {
      db.insert(schema.agents)
        .values({
          id: agent.id,
          name: agent.name,
          slug: agent.name.toLowerCase().replace(/\s+/g, "-"),
          avatar: agent.avatar,
          adapterKind: agent.adapterKind,
          configJson: "{}",
          capabilitiesJson: JSON.stringify(agent.capabilities),
          status: "online",
          isCustom: 0,
          enabled: 1,
          createdAt: now,
          updatedAt: now,
        })
        .run();
      console.log(`[Seed] Created agent: ${agent.name} (${agent.id})`);
    } else {
      // Update existing agent with latest avatar/capabilities
      db.update(schema.agents)
        .set({
          avatar: agent.avatar,
          capabilitiesJson: JSON.stringify(agent.capabilities),
          updatedAt: now,
        } as any)
        .where(eq(schema.agents.id, agent.id))
        .run();
    }
  }
}
