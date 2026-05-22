import { randomUUID } from "node:crypto";

/** Generate a short unique ID using crypto */
export function newId(): string {
  return randomUUID().slice(0, 16);
}

/** ISO timestamp string for now */
export function nowISO(): string {
  return new Date().toISOString();
}
