import type { FileTreeNode } from '@aryazos/ui';
import type { ExportFileEntry } from './types';

const normalizeRelativePath = (relativePath: string): string =>
    relativePath.replace(/\\/g, '/');

export const getBasename = (relativePath: string): string => {
    const normalized = normalizeRelativePath(relativePath);
    const parts = normalized.split('/');
    return parts[parts.length - 1] || '';
};

export const makeGroupNodeId = (parentId: string, groupName: string): string =>
    `group:${parentId}:${encodeURIComponent(groupName)}`;

export function buildFileTree(
    files: ExportFileEntry[],
    folders: string[],
): FileTreeNode {
    const root: FileTreeNode = {
        name: 'Root',
        path: '',
        children: [],
        isFile: false,
    };
    const byPath = new Map<string, FileTreeNode>();
    byPath.set('', root);

    const ensureFolder = (folderPath: string): FileTreeNode => {
        const normalized = normalizeRelativePath(folderPath);
        if (byPath.has(normalized)) {
            return byPath.get(normalized)!;
        }

        const parentPath = normalized.includes('/')
            ? normalized.slice(0, normalized.lastIndexOf('/'))
            : '';
        const parentNode = ensureFolder(parentPath);
        const name = normalized.includes('/')
            ? normalized.slice(normalized.lastIndexOf('/') + 1)
            : normalized;

        const folderNode: FileTreeNode = {
            name,
            path: normalized,
            children: [],
            isFile: false,
        };
        parentNode.children.push(folderNode);
        byPath.set(normalized, folderNode);
        return folderNode;
    };

    for (const folder of folders) {
        if (folder) {
            ensureFolder(folder);
        }
    }

    for (const file of files) {
        const parentPath = file.relativePath.includes('/')
            ? file.relativePath.slice(0, file.relativePath.lastIndexOf('/'))
            : '';
        const parentNode = ensureFolder(parentPath);
        parentNode.children.push({
            name: file.name,
            path: file.relativePath,
            children: [],
            isFile: true,
        });
    }

    const sortTree = (node: FileTreeNode): void => {
        node.children.sort((a, b) => {
            if (a.isFile !== b.isFile) {
                return a.isFile ? 1 : -1;
            }
            return a.name.localeCompare(b.name);
        });
        node.children.forEach(sortTree);
    };

    sortTree(root);
    return root;
}
