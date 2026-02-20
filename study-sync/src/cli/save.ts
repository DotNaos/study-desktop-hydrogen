import type { SyncNode } from '@aryazos/study/types';
import { promises as fs } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { state as moodleState } from '../main/moodle/state';
import { shouldIncludeByDefault } from '../main/services/conversion';
import {
    getCachedFile,
    listChildren,
    materializeNode,
} from '../main/services/studySyncService';
import { resolveNodesByPattern } from './paths';

export interface SaveResult {
    files: string[];
    folders: string[];
    errors: { name: string; id: string; error: string }[];
}

export interface SaveFormatOptions {
    fileFormat?: string;
    folderFormat?: string;
    /** Convert Office files to PDF (default: true) */
    convertToPdf?: boolean;
    /** Include all file types, not just PDFs and convertible (default: false) */
    includeAllTypes?: boolean;
}

const FILE_FORMAT_PRESETS = {
    name: '{filename}.{ext}',
    'name-id': '{filename}__{id}.{ext}',
    id: '{id}.{ext}',
} as const;

const FOLDER_FORMAT_PRESETS = {
    name: '{filename}',
    'name-id': '{filename}__{id}',
    id: '{id}',
} as const;

type FormatPreset = keyof typeof FILE_FORMAT_PRESETS;

function sanitizeSegment(segment: string): string {
    // Replace characters that are problematic on various filesystems
    // : is not allowed on macOS/Windows
    // / and \ are path separators
    // < > " | ? * are not allowed on Windows
    return segment.replace(/[\\/:*?"<>|]/g, '_').trim();
}

function isFolderLike(node: SyncNode): boolean {
    return node.type === 'folder' || node.type === 'composite';
}

function stripExtension(name: string, extension?: string): string {
    if (!extension) return name;
    const lower = name.toLowerCase();
    const suffix = `.${extension.toLowerCase()}`;
    if (lower.endsWith(suffix)) {
        return name.slice(0, -suffix.length);
    }
    return name;
}

async function writeFileAtPath(path: string, data: Buffer): Promise<void> {
    await fs.mkdir(dirname(path), { recursive: true });
    await fs.writeFile(path, data);
}

function applyFormat(format: string, tokens: Record<string, string>): string {
    return format.replace(/\{(\w+)\}/g, (_, key) => tokens[key] ?? '');
}

function resolveFileFormat(preset?: string): string {
    if (!preset) {
        return FILE_FORMAT_PRESETS.name;
    }
    const key = preset.toLowerCase() as FormatPreset;
    if (!Object.prototype.hasOwnProperty.call(FILE_FORMAT_PRESETS, key)) {
        throw new Error(
            `Unknown file format "${preset}". Use: name, name-id, id.`,
        );
    }
    return FILE_FORMAT_PRESETS[key];
}

function resolveFolderFormat(preset?: string): string {
    if (!preset) {
        return FOLDER_FORMAT_PRESETS.name;
    }
    const key = preset.toLowerCase() as FormatPreset;
    if (!Object.prototype.hasOwnProperty.call(FOLDER_FORMAT_PRESETS, key)) {
        throw new Error(
            `Unknown folder format "${preset}". Use: name, name-id, id.`,
        );
    }
    return FOLDER_FORMAT_PRESETS[key];
}

function formatFolderName(node: SyncNode, format: string): string {
    const tokens = {
        filename: sanitizeSegment(node.name),
        id: sanitizeSegment(node.id),
    };
    const raw = applyFormat(format, tokens).trim();
    return sanitizeSegment(raw || tokens.filename);
}

function formatFileName(node: SyncNode, format: string): string {
    const extension = node.fileExtension?.trim() ?? '';
    const baseName = stripExtension(node.name, extension);
    const tokens = {
        filename: sanitizeSegment(baseName),
        id: sanitizeSegment(node.id),
        ext: sanitizeSegment(extension),
    };
    let raw = applyFormat(format, tokens).trim();
    if (!raw) {
        raw = tokens.filename;
    }
    raw = sanitizeSegment(raw);

    if (extension.length > 0) {
        if (format.includes('{ext}')) {
            raw = raw.replace(/\.$/, '');
        } else {
            const lower = raw.toLowerCase();
            const suffix = `.${extension.toLowerCase()}`;
            if (!lower.endsWith(suffix)) {
                raw = `${raw}${suffix}`;
            }
        }
    }

    return raw;
}

function buildFolderPath(
    destRoot: string,
    nodes: SyncNode[],
    folderFormat: string,
): string {
    const segments = nodes.map((node) => formatFolderName(node, folderFormat));
    return join(destRoot, ...segments);
}

async function saveFileNode(
    node: SyncNode,
    destRoot: string,
    folderNodes: SyncNode[],
    formats: SaveFormatOptions,
): Promise<string> {
    if (!node.materialized) {
        const updated = await materializeNode(node.id);
        if (updated) {
            node = updated;
        }
    }

    const fileFormat = resolveFileFormat(formats.fileFormat);
    const fileName = formatFileName(node, fileFormat);
    const folderFormat = resolveFolderFormat(formats.folderFormat);
    const targetPath = join(
        buildFolderPath(destRoot, folderNodes, folderFormat),
        fileName,
    );
    const buffer = getCachedFile(node.id, node.fileExtension);
    if (!buffer) {
        throw new Error(`File data missing in cache for "${node.name}".`);
    }

    await writeFileAtPath(targetPath, buffer);
    return targetPath;
}

async function saveFolderNode(
    node: SyncNode,
    destRoot: string,
    folderNodes: SyncNode[],
    formats: SaveFormatOptions,
): Promise<SaveResult> {
    const folderFormat = resolveFolderFormat(formats.folderFormat);
    const folderPath = buildFolderPath(destRoot, folderNodes, folderFormat);
    await fs.mkdir(folderPath, { recursive: true });

    const children = await listChildren(node.id);
    const result: SaveResult = { files: [], folders: [folderPath], errors: [] };

    for (const child of children) {
        try {
            if (isFolderLike(child)) {
                const nested = await saveFolderNode(
                    child,
                    destRoot,
                    [...folderNodes, child],
                    formats,
                );
                result.files.push(...nested.files);
                result.folders.push(...nested.folders);
                result.errors.push(...nested.errors);
            } else {
                // Check file type filtering before saving
                const ext = (child.fileExtension || extname(child.name))
                    .replace(/^\./, '')
                    .toLowerCase();
                const includeAll = formats.includeAllTypes ?? false;

                if (!includeAll && !shouldIncludeByDefault(ext)) {
                    // Skip file types that aren't PDFs or convertible (unless includeAll is true)
                    continue;
                }

                const savedPath = await saveFileNode(
                    child,
                    destRoot,
                    folderNodes,
                    formats,
                );
                result.files.push(savedPath);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`[WARN] Failed to save "${child.name}": ${message}`);
            result.errors.push({
                name: child.name,
                id: child.id,
                error: message,
            });
        }
    }

    return result;
}

export async function saveNodesByPattern(
    patternSegments: string[],
    destRoot: string,
    formats: SaveFormatOptions,
): Promise<SaveResult> {
    // Set conversion options in moodle state for batch download to use
    moodleState.conversionOptions.convertToPdf = formats.convertToPdf ?? true;
    moodleState.conversionOptions.includeAll = formats.includeAllTypes ?? false;

    const matches = await resolveNodesByPattern(patternSegments);
    const result: SaveResult = { files: [], folders: [], errors: [] };

    for (const match of matches) {
        try {
            if (isFolderLike(match.node)) {
                const saved = await saveFolderNode(
                    match.node,
                    destRoot,
                    match.nodes,
                    formats,
                );
                result.files.push(...saved.files);
                result.folders.push(...saved.folders);
                result.errors.push(...saved.errors);
            } else {
                const folderNodes = match.nodes.slice(0, -1);
                const savedPath = await saveFileNode(
                    match.node,
                    destRoot,
                    folderNodes,
                    formats,
                );
                result.files.push(savedPath);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(
                `[WARN] Failed to save "${match.node.name}": ${message}`,
            );
            result.errors.push({
                name: match.node.name,
                id: match.node.id,
                error: message,
            });
        }
    }

    return result;
}
