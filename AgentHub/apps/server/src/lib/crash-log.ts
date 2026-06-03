// ============================================================
// Crash-log — synchronous file logger for debugging crashes
//
// Writes to data/crash.log with timestamps. Each write is
// synchronous so it survives process crashes.
// ============================================================

import * as fs from "node:fs";
import * as path from "node:path";

const CRASH_LOG_PATH = path.resolve(process.cwd(), "data", "crash.log");

// Ensure the directory exists
const dir = path.dirname(CRASH_LOG_PATH);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

export function crashLog(line: string): void {
  const ts = new Date().toISOString();
  const entry = `[${ts}] ${line}\n`;
  try {
    fs.appendFileSync(CRASH_LOG_PATH, entry, "utf-8");
    // NOTE: no stderr write — EPIPE on broken pipe would crash the process
  } catch {
    // best effort
  }
}
