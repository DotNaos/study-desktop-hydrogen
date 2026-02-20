import { normalizeName } from "../tree/normalize";

export interface CalendarCourse {
  name_raw: string;
  name_norm: string;
}

export function extractCalendarCourses(raw: string, limit = 50): CalendarCourse[] {
  const lines = unfoldLines(raw);
  const seen = new Set<string>();
  const results: CalendarCourse[] = [];

  for (const line of lines) {
    const parsed = parseLine(line);
    if (!parsed) continue;
    if (parsed.key !== "SUMMARY") continue;
    const value = unescapeValue(parsed.value).trim();
    if (!value) continue;
    const nameNorm = normalizeName(value);
    if (!nameNorm || seen.has(nameNorm)) continue;
    seen.add(nameNorm);
    results.push({ name_raw: value, name_norm: nameNorm });
    if (results.length >= limit) break;
  }

  return results;
}

function unfoldLines(raw: string): string[] {
  const rawLines = raw.split(/\r?\n/);
  const result: string[] = [];

  for (const line of rawLines) {
    if (!line) continue;
    if (line.startsWith(" ") || line.startsWith("\t")) {
      const trimmed = line.trim();
      const last = result.pop();
      if (last) {
        result.push(`${last}${trimmed}`);
      } else if (trimmed) {
        result.push(trimmed);
      }
      continue;
    }
    result.push(line);
  }

  return result;
}

function parseLine(line: string): { key: string; value: string } | null {
  const separatorIndex = line.indexOf(":");
  if (separatorIndex < 0) return null;
  const keySegment = line.slice(0, separatorIndex);
  const value = line.slice(separatorIndex + 1);
  const key = keySegment.split(";")[0]?.toUpperCase();
  if (!key) return null;
  return { key, value };
}

function unescapeValue(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}
