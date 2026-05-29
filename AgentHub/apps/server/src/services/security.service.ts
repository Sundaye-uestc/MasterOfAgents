// ============================================================
// SecurityService — secrets encryption, audit logging, risk assessment
// ============================================================

import { getDb, schema } from "../db/index.js";
import { eq, desc } from "drizzle-orm";
import { newId, nowISO } from "../lib/ids.js";
import * as crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";

interface SecretRow {
  id: string;
  name: string;
  provider: string | null;
  encryptedValue: string;
  createdAt: string;
  updatedAt: string;
}

interface AuditLogRow {
  id: string;
  runId: string | null;
  action: string;
  detailJson: string | null;
  createdAt: string;
}

export class SecurityService {
  private getEncryptionKey(): Buffer {
    // Derive key from server-level secret or use default for development
    const secret = process.env["ENCRYPTION_SECRET"] ?? "agenthub-dev-encryption-key-32b!";
    return crypto.createHash("sha256").update(secret).digest();
  }

  // --- Secrets ---

  async listSecrets(): Promise<SecretRow[]> {
    return getDb()
      .select()
      .from(schema.secrets)
      .orderBy(desc(schema.secrets.createdAt))
      .all() as any;
  }

  async getSecret(id: string): Promise<SecretRow | undefined> {
    return getDb()
      .select()
      .from(schema.secrets)
      .where(eq(schema.secrets.id, id))
      .get() as any;
  }

  async createSecret(name: string, value: string, provider?: string): Promise<SecretRow> {
    const db = getDb();
    const now = nowISO();
    const encrypted = this.encrypt(value);

    const row: SecretRow = {
      id: newId(),
      name,
      provider: provider ?? null,
      encryptedValue: encrypted,
      createdAt: now,
      updatedAt: now,
    };

    db.insert(schema.secrets).values({
      id: row.id,
      name: row.name,
      provider: row.provider,
      encryptedValue: row.encryptedValue,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }).run();

    return row;
  }

  async deleteSecret(id: string): Promise<boolean> {
    const db = getDb();
    const secret = await this.getSecret(id);
    if (!secret) return false;
    db.delete(schema.secrets).where(eq(schema.secrets.id, id)).run();
    return true;
  }

  /** Decrypt a stored secret value */
  decrypt(encrypted: string): string {
    try {
      const key = this.getEncryptionKey();
      const parts = encrypted.split(":");
      if (parts.length !== 3) return "";
      const iv = Buffer.from(parts[0]!, "hex");
      const authTag = Buffer.from(parts[1]!, "hex");
      const ciphertext = Buffer.from(parts[2]!, "hex");
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf-8");
    } catch {
      return "";
    }
  }

  private encrypt(plaintext: string): string {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
  }

  /** Strip secrets from content before it enters messages/tool results/logs */
  async sanitizeContent(content: string): Promise<string> {
    const secrets = await this.listSecrets();
    let sanitized = content;
    for (const secret of secrets) {
      const decrypted = this.decrypt(secret.encryptedValue);
      if (decrypted) {
        sanitized = sanitized.replaceAll(decrypted, `[SECRET:${secret.name}]`);
      }
    }
    return sanitized;
  }

  // --- Audit Logs ---

  async writeAuditLog(runId: string | null, action: string, detail?: Record<string, unknown>): Promise<AuditLogRow> {
    const db = getDb();
    const row: AuditLogRow = {
      id: newId(),
      runId,
      action,
      detailJson: detail ? JSON.stringify(detail) : null,
      createdAt: nowISO(),
    };
    db.insert(schema.auditLogs).values({
      id: row.id,
      runId: row.runId,
      action: row.action,
      detailJson: row.detailJson,
      createdAt: row.createdAt,
    }).run();
    return row;
  }

  async listAuditLogs(runId?: string): Promise<AuditLogRow[]> {
    const db = getDb();
    if (runId) {
      return db
        .select()
        .from(schema.auditLogs)
        .where(eq(schema.auditLogs.runId, runId))
        .orderBy(desc(schema.auditLogs.createdAt))
        .all() as any;
    }
    return db
      .select()
      .from(schema.auditLogs)
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(200)
      .all() as any;
  }

  // --- Risk Assessment ---

  /** Check if a command is high-risk and requires confirmation */
  assessCommandRisk(command: string): "low" | "medium" | "high" {
    const highRisk = [
      /\brm\s+-rf\b/, /\bdel\s+/,
      /\bDROP\b/i, /\bTRUNCATE\b/i,
      /\bgit\s+push\b/, /\bgit\s+reset\b/,
      /\bchmod\s+777\b/,
    ];

    const mediumRisk = [
      /\bkill\b/, /\bpkill\b/,
      /\bchmod\b/, /\bchown\b/,
      /\bgit\s+rebase\b/,
    ];

    for (const pattern of highRisk) {
      if (pattern.test(command)) return "high";
    }
    for (const pattern of mediumRisk) {
      if (pattern.test(command)) return "medium";
    }
    return "low";
  }

  getSandboxMode(risk: "low" | "medium" | "high"): "readonly" | "dev" | "deploy" {
    switch (risk) {
      case "high": return "deploy";
      case "medium": return "dev";
      case "low": return "dev";
    }
  }
}