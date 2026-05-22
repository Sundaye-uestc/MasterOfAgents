// ============================================================
// Database connection + initialization for AgentHub
// Uses sql.js (pure JS SQLite, no native compilation needed)
// ============================================================

import initSqlJs from "sql.js";
import type { Database as SqlJsDb } from "sql.js";
import { drizzle } from "drizzle-orm/sql-js";
import * as schema from "./schema.js";
import { runMigrations } from "./migrate.js";
import { resolve } from "node:path";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";

const DB_DIR = resolve(process.cwd(), "data");
const DB_PATH = resolve(DB_DIR, "agenthub.db");

let _db: ReturnType<typeof drizzle> | null = null;
let _sqlDb: SqlJsDb | null = null;

export async function initDb(): Promise<void> {
  mkdirSync(DB_DIR, { recursive: true });

  const SQL = await initSqlJs();

  // Load existing DB or create new
  if (existsSync(DB_PATH)) {
    const buffer = readFileSync(DB_PATH);
    _sqlDb = new SQL.Database(buffer);
  } else {
    _sqlDb = new SQL.Database();
  }

  _sqlDb.run("PRAGMA foreign_keys = ON");
  runMigrations(_sqlDb);
  _db = drizzle(_sqlDb, { schema });
}

export function getDb() {
  if (!_db) {
    throw new Error("Database not initialized. Call initDb() first.");
  }
  return _db;
}

/** Persist the in-memory database to disk */
export function saveDb() {
  if (_sqlDb) {
    const data = _sqlDb.export();
    writeFileSync(DB_PATH, Buffer.from(data));
  }
}

export function closeDb() {
  if (_sqlDb) {
    saveDb();
    _sqlDb.close();
    _sqlDb = null;
    _db = null;
  }
}

export { schema };
export type DatabaseType = ReturnType<typeof getDb>;
