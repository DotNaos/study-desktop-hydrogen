import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

let cachedDataDir: string | null = null;
let cachedDocumentsDir: string | null = null;
let cachedCacheDir: string | null = null;

const requireFromHere = createRequire(__filename);

function resolveElectronPath(kind: "documents"): string | null {
  if (!process.versions?.electron) {
    return null;
  }
  try {
    const electron = requireFromHere("electron");
    if (electron?.app?.getPath) {
      return electron.app.getPath(kind);
    }
  } catch {
    return null;
  }
  return null;
}

export function getStudySyncDataDir(): string {
  if (cachedDataDir) return cachedDataDir;

  const fromEnv =
    process.env["ARYAZOS_STUDY_SYNC_DATA_DIR"] || process.env["STUDY_SYNC_DATA_DIR"];
  if (fromEnv && fromEnv.trim().length > 0) {
    cachedDataDir = fromEnv.trim();
    return cachedDataDir;
  }

  cachedDataDir = join(homedir(), ".aryazos", "study-sync");
  return cachedDataDir;
}

export function getStudySyncDocumentsDir(): string {
  if (cachedDocumentsDir) return cachedDocumentsDir;

  const electronPath = resolveElectronPath("documents");
  if (electronPath) {
    cachedDocumentsDir = electronPath;
    return cachedDocumentsDir;
  }

  cachedDocumentsDir = join(homedir(), "Documents");
  return cachedDocumentsDir;
}

export function ensureStudySyncDataDir(): string {
  const dataDir = getStudySyncDataDir();
  try {
    mkdirSync(dataDir, { recursive: true });
    return dataDir;
  } catch {
    const fallback = join(process.cwd(), ".aryazos-study-sync");
    mkdirSync(fallback, { recursive: true });
    cachedDataDir = fallback;
    return fallback;
  }
}

export function getStudySyncCacheDir(): string {
  if (cachedCacheDir) return cachedCacheDir;
  cachedCacheDir = join(getStudySyncDataDir(), "cache");
  return cachedCacheDir;
}

export function ensureStudySyncCacheDir(): string {
  const cacheDir = getStudySyncCacheDir();
  try {
    mkdirSync(cacheDir, { recursive: true });
    return cacheDir;
  } catch {
    const fallback = join(process.cwd(), ".aryazos-study-sync-cache");
    mkdirSync(fallback, { recursive: true });
    cachedCacheDir = fallback;
    return fallback;
  }
}
