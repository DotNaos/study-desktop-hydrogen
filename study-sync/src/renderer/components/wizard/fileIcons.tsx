import { cn } from '@aryazos/ui/lib/utils';
import type { LucideIcon } from 'lucide-react';
import {
    File,
    FileArchive,
    FileCode2,
    FileImage,
    FileSpreadsheet,
    FileText,
} from 'lucide-react';
import type { ReactElement } from 'react';

const EXTENSION_ICONS: Record<string, LucideIcon> = {
    md: FileText,
    markdown: FileText,
    txt: FileText,
    pdf: FileText,
    csv: FileSpreadsheet,
    xls: FileSpreadsheet,
    xlsx: FileSpreadsheet,
    json: FileCode2,
    yaml: FileCode2,
    yml: FileCode2,
    js: FileCode2,
    ts: FileCode2,
    tsx: FileCode2,
    jsx: FileCode2,
    png: FileImage,
    jpg: FileImage,
    jpeg: FileImage,
    gif: FileImage,
    svg: FileImage,
    webp: FileImage,
    zip: FileArchive,
    tar: FileArchive,
    gz: FileArchive,
};

function normalizeExtension(extension?: string): string | undefined {
    if (!extension) return undefined;
    const trimmed = extension.trim().toLowerCase();
    if (!trimmed) return undefined;
    return trimmed.startsWith('.') ? trimmed.slice(1) : trimmed;
}

export function FileExtensionIcon({
    extension,
    size = 16,
    className,
}: {
    extension?: string;
    size?: number;
    className?: string;
}): ReactElement {
    const normalized = normalizeExtension(extension);
    const Icon = normalized ? (EXTENSION_ICONS[normalized] ?? File) : File;
    return (
        <Icon
            className={cn('text-muted-foreground', className)}
            width={size}
            height={size}
        />
    );
}

export function FileIcon({
    filename,
    size = 16,
    className,
}: {
    filename?: string;
    size?: number;
    className?: string;
}): ReactElement {
    const extension = filename?.split('.').pop();
    return (
        <FileExtensionIcon
            extension={extension}
            size={size}
            className={className}
        />
    );
}
