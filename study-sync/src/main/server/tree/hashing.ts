import { createHash } from "node:crypto";

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => [key, sortObject(val)] as const);
    return Object.fromEntries(entries);
  }
  return value;
}

export function canonicalizePayload(payload?: Record<string, unknown> | null): string {
  if (!payload || Object.keys(payload).length === 0) {
    return "";
  }
  return JSON.stringify(sortObject(payload));
}

export function hashString(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
