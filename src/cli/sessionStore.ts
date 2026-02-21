import { promises as fs } from "node:fs";
import { join } from "node:path";
import { ensureStudySyncDataDir } from "../shared/paths";

export interface CliSession {
  cookies: string;
  schoolId?: string;
  updatedAt: number;
}

const SESSION_FILE = "cli-session.json";

function getSessionPath(): string {
  const dataDir = ensureStudySyncDataDir();
  return join(dataDir, SESSION_FILE);
}

export async function loadCliSession(): Promise<CliSession | null> {
  try {
    const raw = await fs.readFile(getSessionPath(), "utf-8");
    const parsed = JSON.parse(raw) as Partial<CliSession>;
    if (!parsed.cookies || typeof parsed.cookies !== "string") {
      return null;
    }
    return {
      cookies: parsed.cookies,
      schoolId: typeof parsed.schoolId === "string" ? parsed.schoolId : undefined,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export async function saveCliSession(session: CliSession): Promise<void> {
  const payload = {
    cookies: session.cookies,
    schoolId: session.schoolId,
    updatedAt: session.updatedAt,
  };
  await fs.writeFile(getSessionPath(), JSON.stringify(payload, null, 2), "utf-8");
}

export async function clearCliSession(): Promise<void> {
  try {
    await fs.unlink(getSessionPath());
  } catch {
    return;
  }
}
