import type { SyncNode } from '@aryazos/study/types';
import type {
    CliCommand,
    CliContext,
    CliFlagValue,
} from '@aryazos/ts-base/cli';
import { remoteCache } from '../main/remoteCache';
import {
    getDefaultSchool,
    getSchool,
    SCHOOLS,
    type SchoolConfig,
} from '../main/schools';
import {
    getAuthStatus,
    setSession,
    StudySyncServiceError,
} from '../main/services/studySyncService';
import { ProviderErrorCodes } from '../main/types';
import { loginWithPlaywright } from './login';
import {
    listNodesAtPath,
    parseNodePath,
    PathResolutionError,
    resolveNodeByPath,
} from './paths';
import { withStudySyncSession } from './runtime';
import { saveNodesByPattern } from './save';
import { loadCliSession, saveCliSession } from './sessionStore';

function getFlagValue(
    flags: Record<string, CliFlagValue>,
    name: string,
    alias?: string,
): CliFlagValue | undefined {
    return flags[name] ?? (alias ? flags[alias] : undefined);
}

function getStringFlag(
    flags: Record<string, CliFlagValue>,
    name: string,
    alias?: string,
): string | undefined {
    const value = getFlagValue(flags, name, alias);
    if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
    }
    return undefined;
}

function getBooleanFlag(
    flags: Record<string, CliFlagValue>,
    name: string,
    alias?: string,
): boolean | undefined {
    const value = getFlagValue(flags, name, alias);
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'string') {
        const lower = value.toLowerCase();
        if (lower === 'true') return true;
        if (lower === 'false') return false;
    }
    return undefined;
}

function getNumberFlag(
    flags: Record<string, CliFlagValue>,
    name: string,
    alias?: string,
): number | undefined {
    const value = getFlagValue(flags, name, alias);
    if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = Number.parseFloat(value);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return undefined;
}

function isJson(flags: Record<string, CliFlagValue>): boolean {
    return Boolean(getFlagValue(flags, 'json', 'j'));
}

function formatSchoolLabel(school: SchoolConfig): string {
    return `${school.id} (${school.name})`;
}

function listSchoolLabels(): string {
    return SCHOOLS.map(formatSchoolLabel).join(', ');
}

function resolveSchoolId(
    requestedId: string | undefined,
    currentId: string | undefined,
): string {
    if (requestedId && requestedId.trim().length > 0) {
        const requested = requestedId.trim();
        if (getSchool(requested)) {
            return requested;
        }
        throw new Error(
            `Unknown school id "${requested}". Use: ${listSchoolLabels()}.`,
        );
    }

    const ids = SCHOOLS.map((school) => school.id);
    if (ids.length === 0) {
        throw new Error('No schools configured.');
    }
    if (!currentId) {
        return ids[0];
    }
    const currentIndex = ids.indexOf(currentId);
    if (currentIndex === -1) {
        return ids[0];
    }
    return ids[(currentIndex + 1) % ids.length];
}

function formatNodeDisplayName(node: SyncNode): string {
    let name = node.name;
    if (node.type !== 'folder') {
        const ext = node.fileExtension?.trim().replace(/^\./, '');
        if (ext) {
            const lowerName = name.toLowerCase();
            const lowerExt = `.${ext.toLowerCase()}`;
            if (!lowerName.endsWith(lowerExt)) {
                name = `${name}.${ext}`;
            }
        }
    }
    return node.type === 'folder' ? `${name}/` : name;
}

function normalizeProgressValue(progress: number): number {
    if (!Number.isFinite(progress)) return 0;
    return Math.min(Math.max(Math.round(progress), 0), 100);
}

function getNodeProgress(node: SyncNode): number | null {
    if (typeof node.progress === 'number') {
        return normalizeProgressValue(node.progress);
    }
    return null;
}

function formatNodeLine(node: SyncNode): string {
    const progress = getNodeProgress(node);
    const label = progress === null ? ' --' : String(progress).padStart(3, ' ');
    const mark = `[${label}%]`;
    const typeLabel = node.type === 'folder' ? 'dir' : node.type || 'file';
    return `${mark} ${formatNodeDisplayName(node)}\t${typeLabel}\t${node.id}`;
}

function printNodeDetails(ctx: CliContext, node: SyncNode): void {
    ctx.stdout(node.name);
    ctx.stdout(`id: ${node.id}`);
    ctx.stdout(`type: ${node.type}`);
    if (node.parent) ctx.stdout(`parent: ${node.parent}`);
    if (node.fileExtension) ctx.stdout(`fileExtension: ${node.fileExtension}`);
    if (node.materialized !== undefined) {
        ctx.stdout(`materialized: ${node.materialized}`);
    }
    if (node.group) ctx.stdout(`group: ${node.group}`);
    if (node.sourceUrl) ctx.stdout(`sourceUrl: ${node.sourceUrl}`);
    const progress = getNodeProgress(node);
    if (progress !== null) ctx.stdout(`progress: ${progress}`);
}
function formatPathError(error: PathResolutionError): string {
    if (error.issue === 'ambiguous') {
        const matches = error.matches
            .map((node) => `${node.name} (${node.id})`)
            .join(', ');
        return `Ambiguous path segment "${error.segment}". Matches: ${matches}`;
    }
    return `No match for path segment "${error.segment}".`;
}

function formatServiceError(error: unknown): string {
    if (error instanceof PathResolutionError) {
        return formatPathError(error);
    }

    if (error instanceof StudySyncServiceError) {
        if (error.code === ProviderErrorCodes.AUTH_REQUIRED) {
            return 'Not authenticated. Run "aryazos study sync login" or open the study-sync app.';
        }
        if (error.code === 'COOKIES_REQUIRED') {
            return 'Missing session cookies. Run "aryazos study sync login".';
        }
        return error.message;
    }

    if (error instanceof Error) {
        return error.message;
    }

    return 'Unexpected error.';
}

async function runStatus(ctx: CliContext): Promise<void> {
    try {
        await withStudySyncSession({ autoSession: true }, async () => {
            const status = getAuthStatus();
            if (isJson(ctx.flags)) {
                ctx.stdout(JSON.stringify(status, null, 2));
                return;
            }

            ctx.stdout(
                status.authenticated ? 'authenticated' : 'not authenticated',
            );
        });
    } catch (error) {
        ctx.stderr(formatServiceError(error));
        ctx.exit(1);
    }
}

async function runLogin(ctx: CliContext): Promise<void> {
    const schoolId =
        getStringFlag(ctx.flags, 'school', 's') ||
        process.env['ARYAZOS_STUDY_SCHOOL'];
    const username =
        getStringFlag(ctx.flags, 'username') ||
        process.env['MOODLE_USERNAME'];
    const password =
        getStringFlag(ctx.flags, 'password') ||
        process.env['MOODLE_PASSWORD'];
    const headless = getBooleanFlag(ctx.flags, 'headless') ?? true;
    const timeoutSeconds = getNumberFlag(ctx.flags, 'timeout');
    const timeoutMs = timeoutSeconds ? timeoutSeconds * 1000 : undefined;
    const skipFetch = getBooleanFlag(ctx.flags, 'skip-fetch') ?? false;

    try {
        if (username && !password) {
            ctx.stderr('Missing --password (or MOODLE_PASSWORD).');
            ctx.exit(1);
        }

        if (password && !username) {
            ctx.stderr('Missing --username (or MOODLE_USERNAME).');
            ctx.exit(1);
        }

        if (!username || !password) {
            ctx.stdout('Waiting for manual login in the browser window...');
        }

        const session = await loginWithPlaywright({
            schoolId,
            username,
            password,
            headless,
            timeoutMs,
        });

        await saveCliSession({
            cookies: session.cookies,
            schoolId: session.schoolId,
            updatedAt: Date.now(),
        });

        const response = await setSession({
            cookies: session.cookies,
            schoolId: session.schoolId,
            skipFetch,
        });

        if (isJson(ctx.flags)) {
            ctx.stdout(JSON.stringify(response, null, 2));
            return;
        }

        ctx.stdout(
            response.authenticated ? 'authenticated' : 'not authenticated',
        );
    } catch (error) {
        ctx.stderr(formatServiceError(error));
        ctx.exit(1);
    }
}

async function runLoginSwitch(ctx: CliContext): Promise<void> {
    const session = await loadCliSession();
    if (!session) {
        ctx.stderr('No saved session found. Run "aryazos study sync login" first.');
        ctx.exit(1);
    }

    const requestedId = ctx.args[0] || getStringFlag(ctx.flags, 'school', 's');
    const currentId =
        session.schoolId ||
        process.env['ARYAZOS_STUDY_SCHOOL'] ||
        getDefaultSchool().id;
    let targetId: string;
    try {
        targetId = resolveSchoolId(requestedId, currentId);
    } catch (error) {
        const message =
            error instanceof Error
                ? error.message
                : 'Invalid school selection.';
        ctx.stderr(message);
        ctx.exit(1);
    }

    const targetSchool = getSchool(targetId) || getDefaultSchool();
    if (currentId === targetId) {
        ctx.stdout(`Already using ${formatSchoolLabel(targetSchool)}.`);
        return;
    }

    await remoteCache.clearProvider('moodle');
    await saveCliSession({
        cookies: session.cookies,
        schoolId: targetId,
        updatedAt: Date.now(),
    });

    ctx.stdout(`Switched school to ${formatSchoolLabel(targetSchool)}.`);
    ctx.stdout(`If needed, run: aryazos study sync login --school ${targetId}`);
}

async function runList(ctx: CliContext): Promise<void> {
    const pathArg = ctx.args[0];
    const segments = parseNodePath(pathArg);
    const includeGroups = getBooleanFlag(ctx.flags, 'groups', 'g') ?? true; // Default to TRUE for terms

    try {
        await withStudySyncSession({ autoSession: true }, async () => {
            const serverPort = process.env['ARYAZOS_STUDY_SYNC_PORT'] || '3847';
            const baseUrl = `http://localhost:${serverPort}/api/nodes`;

            let nodes: SyncNode[] = [];
            let parentNode: SyncNode | null = null;

            if (segments.length === 0) {
                try {
                    const response = await fetch(
                        `${baseUrl}?includeGroups=${includeGroups}`,
                    );
                    if (response.ok) {
                        nodes = await response.json();
                    } else {
                        const result = await listNodesAtPath(
                            segments,
                            includeGroups,
                        );
                        nodes = result.children;
                    }
                } catch {
                    const result = await listNodesAtPath(
                        segments,
                        includeGroups,
                    );
                    nodes = result.children;
                }
            } else {
                const result = await resolveNodeByPath(segments, includeGroups);
                parentNode = result.node;
                try {
                    const response = await fetch(
                        `${baseUrl}/${parentNode.id}/children?includeGroups=${includeGroups}`,
                    );
                    if (response.ok) {
                        nodes = await response.json();
                    } else {
                        nodes = result.children;
                    }
                } catch {
                    nodes = result.children;
                }
            }

            if (isJson(ctx.flags)) {
                ctx.stdout(
                    JSON.stringify(
                        { node: parentNode, children: nodes },
                        null,
                        2,
                    ),
                );
                return;
            }

            if (parentNode) {
                ctx.stdout(`path: ${segments.join('/')}`);
            }

            for (const node of nodes) {
                ctx.stdout(formatNodeLine(node));
            }
        });
    } catch (error) {
        ctx.stderr(formatServiceError(error));
        ctx.exit(1);
    }
}

async function runNode(ctx: CliContext): Promise<void> {
    const pathArg = ctx.args[0];
    if (!pathArg) {
        ctx.stderr(
            'Missing path. Example: aryazos study sync node "Course/Section"',
        );
        ctx.exit(1);
    }

    const segments = parseNodePath(pathArg);
    if (segments.length === 0) {
        ctx.stderr('Path must include at least one segment.');
        ctx.exit(1);
    }
    try {
        await withStudySyncSession({ autoSession: true }, async () => {
            const result = await resolveNodeByPath(segments);
            if (isJson(ctx.flags)) {
                ctx.stdout(JSON.stringify(result.node, null, 2));
                return;
            }

            printNodeDetails(ctx, result.node);
        });
    } catch (error) {
        ctx.stderr(formatServiceError(error));
        ctx.exit(1);
    }
}

async function runSave(ctx: CliContext): Promise<void> {
    const pathArg = ctx.args[0];
    const destArg = ctx.args[1];
    if (!pathArg) {
        ctx.stderr(
            'Missing path. Example: aryazos study sync save "Course/*" ./downloads',
        );
        ctx.exit(1);
    }

    const segments = parseNodePath(pathArg);
    if (segments.length === 0) {
        ctx.stderr('Path must include at least one segment.');
        ctx.exit(1);
    }

    const destRoot =
        destArg && destArg.trim().length > 0 ? destArg : process.cwd();
    const allowedFormats = new Set(['name', 'name-id', 'id']);
    const formatList = 'name, name-id, id';
    const fileFormat = getStringFlag(ctx.flags, 'file-format')?.toLowerCase();
    const folderFormat = getStringFlag(
        ctx.flags,
        'folder-format',
    )?.toLowerCase();
    const noConversion = getBooleanFlag(ctx.flags, 'no-conversion');
    const noFilter = getBooleanFlag(ctx.flags, 'no-filter');

    if (fileFormat && !allowedFormats.has(fileFormat)) {
        ctx.stderr(`Invalid file format "${fileFormat}". Use: ${formatList}.`);
        ctx.exit(1);
    }
    if (folderFormat && !allowedFormats.has(folderFormat)) {
        ctx.stderr(
            `Invalid folder format "${folderFormat}". Use: ${formatList}.`,
        );
        ctx.exit(1);
    }

    try {
        await withStudySyncSession({ autoSession: true }, async () => {
            const result = await saveNodesByPattern(segments, destRoot, {
                fileFormat: fileFormat || undefined,
                folderFormat: folderFormat || undefined,
                convertToPdf: !noConversion,
                includeAllTypes: noFilter,
            });
            if (isJson(ctx.flags)) {
                ctx.stdout(JSON.stringify(result, null, 2));
                return;
            }

            for (const folder of result.folders) {
                ctx.stdout(`dir: ${folder}`);
            }
            for (const file of result.files) {
                ctx.stdout(`file: ${file}`);
            }
            for (const err of result.errors) {
                ctx.stderr(`error: ${err.name} - ${err.error}`);
            }

            // Summary
            ctx.stdout(
                `\nSummary: ${result.files.length} files, ${result.folders.length} folders`,
            );
            if (result.errors.length > 0) {
                ctx.stderr(`         ${result.errors.length} errors`);
            }
        });
    } catch (error) {
        ctx.stderr(formatServiceError(error));
        ctx.exit(1);
    }
}

async function runExportFile(ctx: CliContext): Promise<void> {
    const pathArg = ctx.args[0];
    const destArg = ctx.args[1];

    if (!pathArg) {
        ctx.stderr(
            'Missing path. Example: aryazos study sync export file "Course/Section/file.pdf" ./output.zip',
        );
        ctx.exit(1);
    }

    const segments = parseNodePath(pathArg);
    if (segments.length === 0) {
        ctx.stderr('Path must include at least one segment.');
        ctx.exit(1);
    }

    const parentLevels = getNumberFlag(ctx.flags, 'parent-levels') ?? 0;

    try {
        await withStudySyncSession({ autoSession: true }, async () => {
            const result = await resolveNodeByPath(segments);
            const node = result.node;

            // For single file without parent levels, just download directly
            if (parentLevels === 0) {
                const serverPort = process.env['ARYAZOS_STUDY_SYNC_PORT'] || '3333';
                const url = `http://localhost:${serverPort}/api/nodes/${node.id}/data`;

                const ext = node.fileExtension?.replace(/^\./, '') || 'pdf';
                const defaultName = `${node.name.replace(/[^a-zA-Z0-9-_]/g, '_')}.${ext}`;
                const destPath =
                    destArg && destArg.trim().length > 0
                        ? destArg
                        : defaultName;

                if (isJson(ctx.flags)) {
                    ctx.stdout(
                        JSON.stringify(
                            {
                                node: { id: node.id, name: node.name },
                                destPath,
                            },
                            null,
                            2,
                        ),
                    );
                    return;
                }

                ctx.stdout(`Downloading ${node.name}...`);

                const response = await fetch(url);
                if (!response.ok) {
                    ctx.stderr('Download failed');
                    ctx.exit(1);
                }

                const { createWriteStream } = await import('node:fs');
                const { pipeline } = await import('node:stream/promises');
                const { Readable } = await import('node:stream');

                const fileStream = createWriteStream(destPath);
                const readable = Readable.fromWeb(response.body as any);
                await pipeline(readable, fileStream);

                ctx.stdout(`Downloaded to: ${destPath}`);
                return;
            }

            // With parent levels, export as ZIP
            const defaultName = `${node.name.replace(/[^a-zA-Z0-9-_]/g, '_')}.zip`;
            const destPath =
                destArg && destArg.trim().length > 0 ? destArg : defaultName;

            const params = new URLSearchParams();
            params.set('includeFiles', 'true');
            params.set('parentLevels', String(parentLevels));
            params.set('maxFiles', '1');

            const serverPort = process.env['ARYAZOS_STUDY_SYNC_PORT'] || '3847';
            const url = `http://localhost:${serverPort}/api/nodes/${node.id}/export?${params.toString()}`;

            if (isJson(ctx.flags)) {
                const infoUrl = `http://localhost:${serverPort}/api/nodes/${node.id}/export/info?parentLevels=${parentLevels}`;
                const infoRes = await fetch(infoUrl);
                const info = await infoRes.json();
                ctx.stdout(JSON.stringify({ ...info, destPath }, null, 2));
                return;
            }

            ctx.stdout(
                `Exporting ${node.name} with ${parentLevels} parent folder(s)...`,
            );

            const response = await fetch(url);
            if (!response.ok) {
                ctx.stderr('Export failed');
                ctx.exit(1);
            }

            const { createWriteStream } = await import('node:fs');
            const { pipeline } = await import('node:stream/promises');
            const { Readable } = await import('node:stream');

            const fileStream = createWriteStream(destPath);
            const readable = Readable.fromWeb(response.body as any);
            await pipeline(readable, fileStream);

            ctx.stdout(`Exported to: ${destPath}`);
        });
    } catch (error) {
        ctx.stderr(formatServiceError(error));
        ctx.exit(1);
    }
}

async function runExportFolder(ctx: CliContext): Promise<void> {
    const pathArg = ctx.args[0];
    const destArg = ctx.args[1];

    if (!pathArg) {
        ctx.stderr(
            'Missing path. Example: aryazos study sync export folder "Course/Section" ./output.zip',
        );
        ctx.exit(1);
    }

    const segments = parseNodePath(pathArg);
    if (segments.length === 0) {
        ctx.stderr('Path must include at least one segment.');
        ctx.exit(1);
    }

    const includeFiles = getBooleanFlag(ctx.flags, 'files') ?? false;
    const parentLevels = getNumberFlag(ctx.flags, 'parent-levels') ?? 0;
    const maxFiles = getNumberFlag(ctx.flags, 'max-files') ?? 5;

    try {
        await withStudySyncSession({ autoSession: true }, async () => {
            const result = await resolveNodeByPath(segments);
            const node = result.node;

            const defaultName = `${node.name.replace(/[^a-zA-Z0-9-_]/g, '_')}.zip`;
            const destPath =
                destArg && destArg.trim().length > 0 ? destArg : defaultName;

            const params = new URLSearchParams();
            params.set('includeFiles', String(includeFiles));
            params.set('parentLevels', String(parentLevels));
            params.set('maxFiles', String(maxFiles));

            // Export locally using ExportService (no server needed)
            const { exportService } =
                await import('../main/services/exportService');
            const { createWriteStream } = await import('node:fs');

            const fileStream = createWriteStream(destPath);

            if (isJson(ctx.flags)) {
                // For JSON mode, we start the export and return success immediately?
                // Or we just return the plan.
                // The original API returned info BEFORE export.
                // Here we just do the export synchronously (awaited).
                // Let's just output the result at the end.
            } else {
                ctx.stdout(`Exporting folder ${node.name}...`);
                if (includeFiles) {
                    ctx.stdout(`  Including up to ${maxFiles} file(s)`);
                } else {
                    ctx.stdout(`  Structure only (no files)`);
                }
                if (parentLevels > 0) {
                    ctx.stdout(`  Including ${parentLevels} parent folder(s)`);
                }
            }

            await exportService.exportNodeToZip(
                node,
                {
                    includeFiles,
                    maxFiles,
                    parentLevels,
                    convertToPdf: true,
                    includeAll: false,
                },
                fileStream,
            );

            if (isJson(ctx.flags)) {
                ctx.stdout(
                    JSON.stringify({ destPath, success: true }, null, 2),
                );
            } else {
                ctx.stdout(`Exported to: ${destPath}`);
            }
        });
    } catch (error) {
        if (isJson(ctx.flags) && (error as any).message) {
            ctx.stderr(JSON.stringify({ error: (error as any).message }));
        } else {
            ctx.stderr(formatServiceError(error));
        }
        ctx.exit(1);
    }
}

async function runExportFiles(ctx: CliContext): Promise<void> {
    const idsArg = ctx.args[0];
    const destArg = ctx.args[1];

    if (!idsArg) {
        ctx.stderr(
            'Missing IDs. Example: aryazos study sync export files "id1,id2,id3" ./output.zip',
        );
        ctx.exit(1);
    }

    const ids = idsArg
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0);
    if (ids.length === 0) {
        ctx.stderr('No valid IDs provided.');
        ctx.exit(1);
    }

    if (ids.length > 10) {
        ctx.stderr('Maximum 10 files can be exported at once.');
        ctx.exit(1);
    }

    const parentLevels = getNumberFlag(ctx.flags, 'parent-levels') ?? 0;
    const archiveName = getStringFlag(ctx.flags, 'name') ?? 'export';

    try {
        await withStudySyncSession({ autoSession: true }, async () => {
            const defaultName = `${archiveName.replace(/[^a-zA-Z0-9-_]/g, '_')}.zip`;
            const destPath =
                destArg && destArg.trim().length > 0 ? destArg : defaultName;

            const serverPort = process.env['ARYAZOS_STUDY_SYNC_PORT'] || '3847';
            const url = `http://localhost:${serverPort}/api/export/files`;

            if (isJson(ctx.flags)) {
                ctx.stdout(
                    JSON.stringify(
                        { ids, parentLevels, archiveName, destPath },
                        null,
                        2,
                    ),
                );
                return;
            }

            ctx.stdout(`Exporting ${ids.length} file(s)...`);
            if (parentLevels > 0) {
                ctx.stdout(`  Including ${parentLevels} parent folder(s)`);
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids, parentLevels, archiveName }),
            });

            if (!response.ok) {
                let errorMessage = 'Export failed';
                try {
                    const error = await response.json();
                    errorMessage = error.message || error.error || errorMessage;
                } catch {
                    // Response might not be JSON
                }
                ctx.stderr(errorMessage);
                ctx.exit(1);
            }

            const { createWriteStream } = await import('node:fs');
            const { pipeline } = await import('node:stream/promises');
            const { Readable } = await import('node:stream');

            const fileStream = createWriteStream(destPath);
            const readable = Readable.fromWeb(response.body as any);
            await pipeline(readable, fileStream);

            ctx.stdout(`Exported to: ${destPath}`);
        });
    } catch (error) {
        ctx.stderr(formatServiceError(error));
        ctx.exit(1);
    }
}

async function runCompletionGet(ctx: CliContext): Promise<void> {
    const pathArg = ctx.args[0];
    if (!pathArg) {
        ctx.stderr('Missing path.');
        ctx.exit(1);
    }

    const segments = parseNodePath(pathArg);
    try {
        await withStudySyncSession({ autoSession: true }, async () => {
            const result = await resolveNodeByPath(segments);
            const node = result.node;

            const serverPort = process.env['ARYAZOS_STUDY_SYNC_PORT'] || '3334';
            const url = `http://localhost:${serverPort}/api/nodes/${node.id}`;

            let targetNode = node;
            let children = result.children;

            try {
                const response = await fetch(url);
                if (response.ok) {
                    targetNode = await response.json();
                } else {
                    // Fallback to local
                }
            } catch {
                // Fallback to local
            }

            const progress = getNodeProgress(targetNode) ?? 0;

            if (isJson(ctx.flags)) {
                ctx.stdout(
                    JSON.stringify(
                        {
                            id: targetNode.id,
                            name: targetNode.name,
                            progress,
                        },
                        null,
                        2,
                    ),
                );
                return;
            }

            ctx.stdout(`Path: ${pathArg}`);
            ctx.stdout(`Progress: ${progress}`);

            if (
                targetNode.type === 'folder' ||
                (targetNode as any).refreshable ||
                (targetNode as any).hasChildren ||
                children.length > 0
            ) {
                ctx.stdout('\nChildren:');

                try {
                    const childrenUrl = `http://localhost:${serverPort}/api/nodes/${node.id}/children`;
                    const childrenResp = await fetch(childrenUrl);
                    if (childrenResp.ok) {
                        children = await childrenResp.json();
                    }
                } catch {
                    // keep local children
                }

                for (const child of children) {
                    const childProgress = getNodeProgress(child);
                    const label =
                        childProgress === null
                            ? ' --'
                            : String(childProgress).padStart(3, ' ');
                    ctx.stdout(`[${label}%] ${child.name}`);
                }
            }
        });
    } catch (error) {
        ctx.stderr(formatServiceError(error));
        ctx.exit(1);
    }
}

async function runCompletionSet(ctx: CliContext): Promise<void> {
    const args = ctx.args;
    if (args.length < 2) {
        ctx.stderr('Usage: completion set <path...> <0-100|true|false>');
        ctx.exit(1);
    }

    const stateStr = args[args.length - 1].toLowerCase();
    const paths = args.slice(0, args.length - 1);

    let progressValue: number | null = null;
    if (stateStr === 'true') progressValue = 100;
    else if (stateStr === 'false') progressValue = 0;
    else {
        const parsed = Number.parseFloat(stateStr);
        if (Number.isFinite(parsed)) {
            progressValue = normalizeProgressValue(parsed);
        }
    }

    if (progressValue === null) {
        ctx.stderr(
            "Last argument must be a number between 0-100 or 'true'/'false'.",
        );
        ctx.exit(1);
    }

    try {
        await withStudySyncSession({ autoSession: true }, async () => {
            const updates: Record<string, number> = {};

            for (const path of paths) {
                const segments = parseNodePath(path);
                const result = await resolveNodeByPath(segments);
                updates[result.node.id] = progressValue!;
            }

            const serverPort = process.env['ARYAZOS_STUDY_SYNC_PORT'] || '3334';
            const url = `http://localhost:${serverPort}/api/nodes/progress/batch`;

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ updates }),
            });

            if (!response.ok) {
                const body = await response.text();
                ctx.stderr(
                    `Failed to update progress: ${response.status} ${response.statusText}\n${body}`,
                );
                ctx.exit(1);
            }

            ctx.stdout(
                `Updated ${Object.keys(updates).length} item(s) to ${progressValue}.`,
            );
        });
    } catch (error) {
        ctx.stderr(formatServiceError(error));
        ctx.exit(1);
    }
}

async function runCompletionUpdate(ctx: CliContext): Promise<void> {
    const args = ctx.args;
    if (args.length === 0) {
        ctx.stderr('Usage: completion update <path=0-100|true|false...>');
        ctx.exit(1);
    }

    try {
        await withStudySyncSession({ autoSession: true }, async () => {
            const updates: Record<string, number> = {};

            for (const arg of args) {
                const eqIndex = arg.lastIndexOf('=');
                if (eqIndex === -1) {
                    ctx.stderr(
                        `Invalid format: "${arg}". Expected "path=value".`,
                    );
                    ctx.exit(1);
                }

                const path = arg.substring(0, eqIndex);
                const valStr = arg.substring(eqIndex + 1).toLowerCase();
                let progressValue: number | null = null;
                if (valStr === 'true') progressValue = 100;
                else if (valStr === 'false') progressValue = 0;
                else {
                    const parsed = Number.parseFloat(valStr);
                    if (Number.isFinite(parsed)) {
                        progressValue = normalizeProgressValue(parsed);
                    }
                }
                if (progressValue === null) {
                    ctx.stderr(
                        `Invalid value for "${path}": "${valStr}". Expected 0-100 or true/false.`,
                    );
                    ctx.exit(1);
                }

                const segments = parseNodePath(path);
                const result = await resolveNodeByPath(segments, true);
                updates[result.node.id] = progressValue;
            }

            const serverPort = process.env['ARYAZOS_STUDY_SYNC_PORT'] || '3847';
            const url = `http://localhost:${serverPort}/api/nodes/progress/batch`;

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ updates }),
            });

            if (!response.ok) {
                ctx.stderr('Failed to update progress.');
                ctx.exit(1);
            }

            if (isJson(ctx.flags)) {
                ctx.stdout(
                    JSON.stringify(
                        { success: true, count: Object.keys(updates).length },
                        null,
                        2,
                    ),
                );
            } else {
                ctx.stdout(`Updated ${Object.keys(updates).length} item(s).`);
            }
        });
    } catch (error) {
        ctx.stderr(formatServiceError(error));
        ctx.exit(1);
    }
}

async function runComplete(ctx: CliContext): Promise<void> {
    const current = ctx.args[0] || '';
    const segments = parseNodePath(current);
    const isTrailingSlash = current.endsWith('/');

    // If no trailing slash and not empty, we are completing the last segment
    const parentSegments = isTrailingSlash ? segments : segments.slice(0, -1);
    const currentSegment = isTrailingSlash
        ? ''
        : segments[segments.length - 1] || '';

    try {
        await withStudySyncSession({ autoSession: true }, async () => {
            const { children } = await listNodesAtPath(parentSegments, true);
            const matches = children
                .filter((c) => {
                    const name = c.name.toLowerCase().replace(/ /g, '_');
                    return name.startsWith(currentSegment.toLowerCase());
                })
                .sort((a, b) => {
                    return a.name.localeCompare(b.name, undefined, {
                        numeric: true,
                        sensitivity: 'base',
                    });
                });

            for (const m of matches) {
                const prefix =
                    parentSegments.length > 0
                        ? parentSegments.join('/') + '/'
                        : '';
                let name = m.name.replace(/ /g, '_');
                if (m.type !== 'folder' && m.fileExtension) {
                    name += '.' + m.fileExtension;
                }
                const suffix = m.type === 'folder' ? '/' : '';
                ctx.stdout(prefix + name + suffix);
            }
        });
    } catch {
        // Silent fail for completions
    }
}

async function runCompletionScript(ctx: CliContext): Promise<void> {
    ctx.stdout(`#compdef aryazos


_aryazos() {
  local -a completions
  local word="\${words[CURRENT]}"
  local prev_word="\${words[CURRENT-1]}"
  local cmd_path="\${words[1,CURRENT-1]}"

  # Check if we are at 'aryazos' command level
  if [[ "\$CURRENT" -eq 2 ]]; then
     completions=('study:Study tools')
     _describe 'commands' completions
     return
  fi

  # Check if we are at 'aryazos study' level
  if [[ "\$cmd_path" == "aryazos study" ]]; then
     completions=('sync:Sync tools')
     _describe 'commands' completions
     return
  fi

  # Check if we are at 'aryazos study sync' level
  if [[ "\$cmd_path" == "aryazos study sync" ]]; then
     completions=('ls:List nodes' 'get:Get node details' 'node:Get node details' 'save:Save' 'export:Export' 'status:Check status' 'login:Login' 'completion:Manage progress' 'completions:Generate completion script')
     _describe 'commands' completions
     return
  fi

  # Check if we are completing arguments for the commands that support path completion
  if [[ "\$prev_word" == "get" || "\$prev_word" == "set" || "\$prev_word" == "ls" || "\$prev_word" == "node" || "\$prev_word" == "save" || "\$prev_word" == "export" ]]; then
     # Use the CLI itself to generate completions
     completions=("\${(@f)\$(aryazos study sync _complete "\$word")}")
     if [[ -n "\$completions" ]]; then
       compadd -S '' -a completions
     fi
     return
  fi

}


_aryazos "$@"`);
}

export function createSyncCommand(): CliCommand {
    const baseOptions = [
        { name: 'json', alias: 'j', description: 'Output JSON' },
    ];

    return {
        name: 'sync',
        description: 'Study Sync tools',
        run: (ctx) => ctx.showHelp(),
        subcommands: [
            {
                name: 'status',
                description: 'Show authentication status',
                options: baseOptions,
                run: runStatus,
            },
            {
                name: 'login',
                description: 'Login via Playwright and register the session',
                run: runLogin,
                subcommands: [
                    {
                        name: 'switch',
                        description:
                            'Switch the active school (rotates if omitted)',
                        args: '[school]',
                        options: [
                            {
                                name: 'school',
                                alias: 's',
                                description: 'School id (e.g. fhgr)',
                            },
                        ],
                        run: runLoginSwitch,
                    },
                ],
                options: [
                    {
                        name: 'school',
                        alias: 's',
                        description: 'School id (e.g. fhgr)',
                    },
                    { name: 'username', description: 'Login username/email' },
                    { name: 'password', description: 'Login password' },
                    {
                        name: 'headless',
                        description: 'Run browser in headless mode',
                    },
                    {
                        name: 'timeout',
                        description: 'Login timeout in seconds',
                    },
                    {
                        name: 'skip-fetch',
                        description: 'Skip initial course fetch',
                    },
                    { name: 'json', alias: 'j', description: 'Output JSON' },
                ],
            },
            {
                name: 'ls',
                aliases: ['children', 'list'],
                description: 'List children at a path',
                args: '[path]',
                options: [
                    ...baseOptions,
                    {
                        name: 'groups',
                        alias: 'g',
                        description: 'Show grouping nodes (Terms/Sections)',
                    },
                ],
                run: runList,
            },
            {
                name: 'node',
                aliases: ['get'],
                description: 'Show node metadata for a path',
                args: '<path>',
                options: baseOptions,
                run: runNode,
            },
            {
                name: 'save',
                description: 'Save files/folders to a destination on disk',
                args: '<remote-path> [dest-path]',
                options: [
                    ...baseOptions,
                    {
                        name: 'file-format',
                        description: 'Filename format (name | name-id | id)',
                    },
                    {
                        name: 'folder-format',
                        description: 'Folder format (name | name-id | id)',
                    },
                ],
                run: runSave,
            },
            {
                name: '_complete',
                hidden: true,
                args: '<prefix>',
                run: runComplete,
            },
            {
                name: 'completions',
                description: 'Generate shell completion script',
                args: '[shell]',
                run: runCompletionScript,
            },
            {
                name: 'export',
                description: 'Export nodes as ZIP archives',
                run: (ctx) => ctx.showHelp(),
                subcommands: [
                    {
                        name: 'file',
                        description:
                            'Export a single file (optionally with parent folders)',
                        args: '<remote-path> [dest-path]',
                        options: [
                            ...baseOptions,
                            {
                                name: 'parent-levels',
                                description:
                                    'Include N parent folders (creates ZIP if > 0)',
                            },
                        ],
                        run: runExportFile,
                    },
                    {
                        name: 'folder',
                        description: 'Export a folder structure as ZIP',
                        args: '<remote-path> [dest-path]',
                        options: [
                            ...baseOptions,
                            {
                                name: 'files',
                                description:
                                    'Include files in export (default: false)',
                            },
                            {
                                name: 'parent-levels',
                                description:
                                    'Include N parent folders (default: 0)',
                            },
                            {
                                name: 'max-files',
                                description:
                                    'Max files to include (1-10, default: 5)',
                            },
                        ],
                        run: runExportFolder,
                    },
                    {
                        name: 'files',
                        description: 'Export multiple files by IDs as ZIP',
                        args: '<ids> [dest-path]',
                        options: [
                            ...baseOptions,
                            {
                                name: 'parent-levels',
                                description:
                                    'Include N parent folders (default: 0)',
                            },
                            {
                                name: 'name',
                                description: 'Archive name (default: export)',
                            },
                        ],
                        run: runExportFiles,
                    },
                ],
            },
            {
                name: 'completion',
                description: 'Manage progress (0-100)',
                run: (ctx) => ctx.showHelp(),
                subcommands: [
                    {
                        name: 'get',
                        description: 'Get progress for a path',
                        args: '<path>',
                        options: baseOptions,
                        run: runCompletionGet,
                    },
                    {
                        name: 'set',
                        description: 'Set progress for one or more paths',
                        args: '<path...> <0-100|true|false>',
                        options: baseOptions,
                        run: runCompletionSet,
                    },
                    {
                        name: 'update',
                        description: 'Update progress with mixed values',
                        args: '<path=0-100|true|false...>',
                        options: baseOptions,
                        run: runCompletionUpdate,
                    },
                ],
            },
        ],
    };
}
