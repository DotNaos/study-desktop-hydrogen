import type { SyncNode } from '@aryazos/study/types';
import { createLogger } from '@aryazos/ts-base/logging';
import archiver from 'archiver';
import { createWriteStream, promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { primaryProvider } from './providers';
import { remoteCache } from './remoteCache';
import { treeService } from './server/tree';

const logger = createLogger('com.aryazos.study-sync.export-desktop');

export interface DesktopSaveAsResult {
    fileCount: number;
    outputPath: string;
}

function sanitizeName(name: string): string {
    return (
        name
            .normalize('NFC')
            .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
            .trim() || 'unnamed'
    );
}

function isFolderNode(node: SyncNode): boolean {
    return node.type === 'folder' || node.type === 'composite';
}

function normalizeExtension(extension?: string): string {
    const ext = (extension || 'pdf').replace(/^\./, '').trim().toLowerCase();
    return ext || 'pdf';
}

function withExtension(fileName: string, extension: string): string {
    const safeName = sanitizeName(fileName);
    const ext = normalizeExtension(extension);
    if (safeName.toLowerCase().endsWith(`.${ext}`)) {
        return safeName;
    }
    return `${safeName}.${ext}`;
}

async function getNodeById(nodeId: string): Promise<SyncNode> {
    await treeService.ensureBuilt();

    const fromTree = await treeService.store.getNode(nodeId);
    if (fromTree) {
        return fromTree;
    }

    const fromProvider = await primaryProvider.getNode(nodeId);
    if (fromProvider) {
        return fromProvider;
    }

    throw new Error(`NODE_NOT_FOUND:${nodeId}`);
}

async function getNodeChildren(node: SyncNode): Promise<SyncNode[]> {
    const fromTree = await treeService.store.getChildren(node.id);
    if (fromTree.length > 0) {
        return fromTree;
    }
    return primaryProvider.listNodes(node.id);
}

async function getResourceData(node: SyncNode): Promise<{
    data: Buffer;
    extension: string;
}> {
    const initialExtension = normalizeExtension(node.fileExtension);

    if (remoteCache.hasFile(node.id, initialExtension)) {
        const cached = remoteCache.getFile(node.id, initialExtension);
        if (cached) {
            return { data: cached, extension: initialExtension };
        }
    }

    if (remoteCache.hasFile(node.id, 'pdf')) {
        const cachedPdf = remoteCache.getFile(node.id, 'pdf');
        if (cachedPdf) {
            return { data: cachedPdf, extension: 'pdf' };
        }
    }

    const materialized = await primaryProvider.materializeNode(node.id);
    if (!materialized) {
        throw new Error(`UNSUPPORTED_RESOURCE:${node.id}`);
    }

    const resolvedExtension = normalizeExtension(
        materialized.fileExtension || node.fileExtension,
    );
    const materializedData =
        remoteCache.getFile(node.id, resolvedExtension) ??
        remoteCache.getFile(node.id, 'pdf');

    if (!materializedData) {
        throw new Error(`EXPORT_FILE_MISSING:${node.id}`);
    }

    return { data: materializedData, extension: resolvedExtension };
}

async function writeNodeToDirectory(
    node: SyncNode,
    destinationDir: string,
): Promise<number> {
    if (isFolderNode(node)) {
        const folderPath = path.join(destinationDir, sanitizeName(node.name));
        await fs.mkdir(folderPath, { recursive: true });

        let fileCount = 0;
        const children = await getNodeChildren(node);
        for (const child of children) {
            fileCount += await writeNodeToDirectory(child, folderPath);
        }
        return fileCount;
    }

    const { data, extension } = await getResourceData(node);
    const outputPath = path.join(
        destinationDir,
        withExtension(node.name, extension),
    );
    await fs.mkdir(destinationDir, { recursive: true });
    await fs.writeFile(outputPath, data);
    return 1;
}

async function addNodeToArchive(
    node: SyncNode,
    archive: archiver.Archiver,
    basePath: string,
    usedNames: Set<string>,
): Promise<number> {
    if (isFolderNode(node)) {
        let folderName = sanitizeName(node.name);

        // Deduplicate folder name
        let folderPath = basePath
            ? path.posix.join(basePath, folderName)
            : folderName;
        let suffix = 1;
        while (usedNames.has(folderPath.toLowerCase())) {
            folderName = `${sanitizeName(node.name)} (${suffix})`;
            folderPath = basePath
                ? path.posix.join(basePath, folderName)
                : folderName;
            suffix++;
        }
        usedNames.add(folderPath.toLowerCase());

        archive.append('', { name: `${folderPath}/` });

        let fileCount = 0;
        const children = await getNodeChildren(node);
        const childUsedNames = new Set<string>(); // Scoped to this folder
        for (const child of children) {
            fileCount += await addNodeToArchive(
                child,
                archive,
                folderPath,
                childUsedNames,
            );
        }
        return fileCount;
    }

    const { data, extension } = await getResourceData(node);
    let fileName = withExtension(node.name, extension);

    // Deduplicate file name
    let filePath = basePath ? path.posix.join(basePath, fileName) : fileName;
    let suffix = 1;
    while (usedNames.has(filePath.toLowerCase())) {
        const nameWithoutExt = sanitizeName(node.name);
        fileName = withExtension(`${nameWithoutExt} (${suffix})`, extension);
        filePath = basePath ? path.posix.join(basePath, fileName) : fileName;
        suffix++;
    }
    usedNames.add(filePath.toLowerCase());

    archive.append(data, { name: filePath });
    return 1;
}
async function createZipForNode(
    node: SyncNode,
    zipPath: string,
): Promise<number> {
    await fs.mkdir(path.dirname(zipPath), { recursive: true });

    const output = createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    const completion = new Promise<void>((resolve, reject) => {
        output.on('close', () => resolve());
        output.on('error', reject);
        archive.on('error', reject);
    });

    archive.pipe(output);

    const fileCount = await addNodeToArchive(
        node,
        archive,
        '',
        new Set<string>(),
    );
    await archive.finalize();
    await completion;

    return fileCount;
}

export async function exportNodeSaveAs(
    nodeId: string,
    destinationDir: string,
): Promise<DesktopSaveAsResult> {
    const node = await getNodeById(nodeId);

    if (isFolderNode(node)) {
        const fileCount = await writeNodeToDirectory(node, destinationDir);
        return {
            fileCount,
            outputPath: path.join(destinationDir, sanitizeName(node.name)),
        };
    }

    const fileCount = await writeNodeToDirectory(node, destinationDir);
    const outputPath = path.join(
        destinationDir,
        withExtension(node.name, normalizeExtension(node.fileExtension)),
    );
    return { fileCount, outputPath };
}

export async function exportNodeForAction(
    nodeId: string,
): Promise<{ fileCount: number; outputPath: string }> {
    const node = await getNodeById(nodeId);

    if (isFolderNode(node)) {
        const archiveName = sanitizeName(node.name);
        const tempRoot = await fs.mkdtemp(
            path.join(tmpdir(), 'study-desktop-zip-'),
        );
        const zipPath = path.join(tempRoot, `${archiveName}.zip`);

        const fileCount = await createZipForNode(node, zipPath);

        logger.info('Created action archive for folder', {
            nodeId,
            zipPath,
            fileCount,
        });

        return {
            fileCount,
            outputPath: zipPath,
        };
    }

    const tempRoot = await fs.mkdtemp(
        path.join(tmpdir(), 'study-desktop-action-'),
    );
    const fileCount = await writeNodeToDirectory(node, tempRoot);
    const outputPath = path.join(
        tempRoot,
        withExtension(node.name, normalizeExtension(node.fileExtension)),
    );

    return { fileCount, outputPath };
}
