import AdmZip from 'adm-zip';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SyncNode } from '../shared/studyTypes';

const {
    ensureBuiltMock,
    getNodeMock,
    getChildrenMock,
    providerGetNodeMock,
    providerListNodesMock,
    providerMaterializeNodeMock,
    hasFileMock,
    getFileMock,
} = vi.hoisted(() => ({
    ensureBuiltMock: vi.fn(),
    getNodeMock: vi.fn(),
    getChildrenMock: vi.fn(),
    providerGetNodeMock: vi.fn(),
    providerListNodesMock: vi.fn(),
    providerMaterializeNodeMock: vi.fn(),
    hasFileMock: vi.fn(),
    getFileMock: vi.fn(),
}));

vi.mock('./server/tree', () => ({
    treeService: {
        ensureBuilt: ensureBuiltMock,
        store: {
            getNode: getNodeMock,
            getChildren: getChildrenMock,
        },
    },
}));

vi.mock('./providers', () => ({
    primaryProvider: {
        getNode: providerGetNodeMock,
        listNodes: providerListNodesMock,
        materializeNode: providerMaterializeNodeMock,
    },
}));

vi.mock('./remoteCache', () => ({
    remoteCache: {
        hasFile: hasFileMock,
        getFile: getFileMock,
    },
}));

import { exportNodeSaveAs, exportNodeToShareZip } from './exportDesktop';

describe('exportDesktop', () => {
    let tempDir: string;

    const folderNode: SyncNode = {
        id: 'folder-1',
        name: 'Week 1',
        type: 'folder',
    };

    const fileNode: SyncNode = {
        id: 'file-1',
        name: 'Lecture Notes',
        type: 'file',
        fileExtension: 'pdf',
    };

    beforeEach(async () => {
        vi.clearAllMocks();
        tempDir = await mkdtemp(path.join(tmpdir(), 'study-desktop-test-'));
    });

    afterEach(async () => {
        await rm(tempDir, { recursive: true, force: true });
    });

    it('exports a folder subtree unzipped into target directory', async () => {
        getNodeMock.mockResolvedValue(folderNode);
        getChildrenMock.mockImplementation(async (id: string) => {
            if (id === 'folder-1') {
                return [fileNode];
            }
            return [];
        });

        hasFileMock.mockImplementation((id: string, ext: string) => {
            return id === 'file-1' && ext === 'pdf';
        });
        getFileMock.mockImplementation((id: string, ext: string) => {
            if (id === 'file-1' && ext === 'pdf') {
                return Buffer.from('pdf-content');
            }
            return null;
        });

        const result = await exportNodeSaveAs('folder-1', tempDir);

        expect(result.fileCount).toBe(1);
        expect(result.outputPath).toBe(path.join(tempDir, 'Week 1'));

        const outputFilePath = path.join(
            tempDir,
            'Week 1',
            'Lecture Notes.pdf',
        );
        const data = await readFile(outputFilePath, 'utf-8');
        expect(data).toBe('pdf-content');
    });

    it('creates a share zip for a resource node', async () => {
        getNodeMock.mockResolvedValue(fileNode);
        getChildrenMock.mockResolvedValue([]);

        hasFileMock.mockImplementation((id: string, ext: string) => {
            return id === 'file-1' && ext === 'pdf';
        });
        getFileMock.mockImplementation((id: string, ext: string) => {
            if (id === 'file-1' && ext === 'pdf') {
                return Buffer.from('zip-pdf-content');
            }
            return null;
        });

        const result = await exportNodeToShareZip('file-1');

        expect(result.fileCount).toBe(1);
        expect(result.zipPath.endsWith('.zip')).toBe(true);

        const zip = new AdmZip(result.zipPath);
        const entryNames = zip.getEntries().map((entry) => entry.entryName);
        expect(entryNames).toContain('Lecture Notes.pdf');

        await rm(result.zipPath, { force: true });
    });
});
