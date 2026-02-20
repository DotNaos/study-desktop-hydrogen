import { createLogger } from '@aryazos/ts-base/logging';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join, normalize, resolve, sep } from 'node:path';
import { getStudySyncDocumentsDir } from '../shared/paths';

const logger = createLogger('com.aryazos.study-sync.vault.api');

export interface VaultManifestEntry {
    path: string;
    size: number;
    mtimeMs: number;
    sha256?: string;
}

function getDefaultVaultPath(): string {
    return join(getStudySyncDocumentsDir(), 'vault');
}

function getEffectiveVaultPath(): string {
    const fromEnv = process.env['STUDY_SYNC_VAULT_PATH'];
    if (fromEnv && typeof fromEnv === 'string' && fromEnv.trim().length > 0) {
        return fromEnv.trim();
    }
    return getDefaultVaultPath();
}

function ensureRelativePathIsSafe(relativePath: string): string | null {
    if (!relativePath) return null;
    if (relativePath.includes('\0')) return null;

    const cleaned = normalize(relativePath).replaceAll('\\', '/');
    if (cleaned.startsWith('../') || cleaned === '..') return null;
    if (cleaned.startsWith('/')) return null;
    if (!cleaned.startsWith('nodes/')) return null;

    const parts = cleaned.split('/').filter(Boolean);
    if (parts.length !== 3) return null;

    const folder = parts[1];
    const filename = parts[2];

    if (folder !== 'pdf' && folder !== 'ink' && folder !== 'yaml') return null;
    if (!filename.includes('.')) return null;

    const ext = filename.split('.').pop()?.toLowerCase();
    if (!ext) return null;
    if (folder === 'pdf' && ext !== 'pdf') return null;
    if (folder === 'ink' && ext !== 'ink') return null;
    if (folder === 'yaml' && ext !== 'yaml' && ext !== 'yml') return null;

    return cleaned;
}

function toAbsoluteVaultPath(safeRelativePath: string): string {
    const vaultPath = getEffectiveVaultPath();
    const vaultResolved = resolve(vaultPath);
    const absResolved = resolve(vaultResolved, safeRelativePath);

    // Hard guard: ensure `abs` is within `vaultPath` even on weird platforms.
    const vaultPrefix = normalize(vaultResolved + sep);
    const absNormalized = normalize(absResolved);
    if (!absNormalized.startsWith(vaultPrefix)) {
        throw new Error('Invalid vault path escape attempt');
    }
    return absResolved;
}

function sha256Hex(input: Buffer | string): string {
    return createHash('sha256').update(input).digest('hex');
}

async function sha256HexOfFile(absolutePath: string): Promise<string> {
    const buf = await readFile(absolutePath);
    return sha256Hex(buf);
}

export async function getVaultManifest(): Promise<VaultManifestEntry[]> {
    const vaultPath = getEffectiveVaultPath();
    const roots = [
        { folder: 'pdf', ext: '.pdf', includeSha: false },
        { folder: 'ink', ext: '.ink', includeSha: true },
        { folder: 'yaml', ext: '.yaml', includeSha: true },
        { folder: 'yaml', ext: '.yml', includeSha: true },
    ] as const;

    const entries: VaultManifestEntry[] = [];

    for (const root of roots) {
        const dir = join(vaultPath, 'nodes', root.folder);
        let files: string[] = [];
        try {
            files = await readdir(dir);
        } catch {
            continue;
        }

        for (const file of files) {
            if (!file.toLowerCase().endsWith(root.ext)) continue;

            const absolutePath = join(dir, file);
            try {
                const s = await stat(absolutePath);
                const relativePath = `nodes/${root.folder}/${file}`;
                const entry: VaultManifestEntry = {
                    path: relativePath,
                    size: s.size,
                    mtimeMs: s.mtimeMs,
                };
                if (root.includeSha) {
                    entry.sha256 = await sha256HexOfFile(absolutePath);
                }
                entries.push(entry);
            } catch (error) {
                logger.warn('Skipping vault file (stat/hash failed)', {
                    absolutePath,
                    error,
                });
            }
        }
    }

    entries.sort((a, b) => a.path.localeCompare(b.path));
    return entries;
}

export async function readVaultFile(
    relativePath: string,
): Promise<{
    stream: ReturnType<typeof createReadStream>;
    contentType: string;
    etag?: string;
} | null> {
    const safe = ensureRelativePathIsSafe(relativePath);
    if (!safe) return null;

    const absolutePath = toAbsoluteVaultPath(safe);
    try {
        const s = await stat(absolutePath);
        if (!s.isFile()) return null;

        const contentType = safe.endsWith('.pdf')
            ? 'application/pdf'
            : safe.endsWith('.ink')
              ? 'application/json'
              : 'text/yaml';

        const etag = `"${s.size}-${Math.floor(s.mtimeMs)}"`;
        return { stream: createReadStream(absolutePath), contentType, etag };
    } catch {
        return null;
    }
}

export type WriteInkResult =
    | { kind: 'ok'; sha256: string; mtimeMs: number; size: number }
    | { kind: 'conflict'; serverSha256: string; serverContent: string };

export async function writeVaultInkFile(
    relativePath: string,
    params: { content: string; baseSha256?: string },
): Promise<WriteInkResult> {
    const safe = ensureRelativePathIsSafe(relativePath);
    if (!safe || !safe.startsWith('nodes/ink/') || !safe.endsWith('.ink')) {
        throw new Error('Only nodes/ink/*.ink writes are allowed');
    }

    const absolutePath = toAbsoluteVaultPath(safe);
    await mkdir(join(getEffectiveVaultPath(), 'nodes', 'ink'), {
        recursive: true,
    });

    // Validate JSON to avoid corrupting the vault with invalid content.
    try {
        JSON.parse(params.content);
    } catch {
        throw new Error('Invalid JSON content for .ink file');
    }

    let serverSha256: string | null = null;
    let serverContent: string | null = null;

    try {
        const serverBuf = await readFile(absolutePath, 'utf-8');
        serverContent = serverBuf;
        serverSha256 = sha256Hex(serverBuf);
    } catch {
        serverSha256 = null;
        serverContent = null;
    }

    if (
        params.baseSha256 &&
        serverSha256 &&
        params.baseSha256 !== serverSha256
    ) {
        return {
            kind: 'conflict',
            serverSha256,
            serverContent: serverContent ?? '',
        };
    }

    const nextSha256 = sha256Hex(params.content);
    await writeFile(absolutePath, params.content, 'utf-8');
    const s = await stat(absolutePath);

    return { kind: 'ok', sha256: nextSha256, mtimeMs: s.mtimeMs, size: s.size };
}
