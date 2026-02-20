import { createLogger } from '@aryazos/ts-base/logging';
import {
    Button,
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@aryazos/ui/shadcn';
import { useEffect, useState } from 'react';
import type { EnrichedRemoteNode } from './types';

const logger = createLogger(
    'com.aryazos.study-sync.renderer.wizard.download-dialog',
);

interface DownloadDestinationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    node: EnrichedRemoteNode | null;
    onConfirm: (destinationPath: string) => Promise<void>;
}

export function DownloadDestinationDialog({
    open,
    onOpenChange,
    node,
    onConfirm,
}: DownloadDestinationDialogProps) {
    const [destinationPath, setDestinationPath] = useState('');
    const [loading, setLoading] = useState(false);

    // Extract file extension from the node name
    const getExtension = (): string | undefined => {
        if (!node) return undefined;
        if (node.fileExtension) return node.fileExtension;
        const extMatch = node.name.match(/\.([a-zA-Z0-9]+)$/);
        return extMatch?.[1];
    };

    // Get base name without extension
    const getBaseName = (path: string): string => {
        const ext = getExtension();
        if (ext && path.endsWith(`.${ext}`)) {
            return path.slice(0, -(ext.length + 1));
        }
        return path;
    };

    const extension = getExtension();
    const isFile = node?.type === 'file';

    useEffect(() => {
        if (open && node) {
            // Use the full remote path if available, otherwise just the name
            const fullPath = node.remotePath || node.name;
            // For files, strip the extension from the editable part
            if (isFile && extension) {
                setDestinationPath(getBaseName(fullPath));
            } else {
                setDestinationPath(fullPath);
            }
        }
    }, [open, node]);

    const handleConfirm = async () => {
        if (!destinationPath) return;
        setLoading(true);
        try {
            // Re-add extension for files
            const finalPath =
                isFile && extension
                    ? `${destinationPath}.${extension}`
                    : destinationPath;
            await onConfirm(finalPath);
            onOpenChange(false);
        } catch (err) {
            logger.error('Download failed', { error: err });
            // Ideally show error toast
        } finally {
            setLoading(false);
        }
    };

    if (!node) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px]">
                <DialogHeader>
                    <DialogTitle>Download "{node.name}"</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <label
                            htmlFor="destination"
                            className="text-sm font-medium leading-none"
                        >
                            Destination Path
                        </label>
                        <div className="flex h-9 w-full rounded-md border border-input bg-transparent shadow-sm transition-colors focus-within:ring-1 focus-within:ring-ring disabled:cursor-not-allowed disabled:opacity-50 items-center overflow-hidden">
                            <input
                                id="destination"
                                value={destinationPath}
                                onChange={(e) =>
                                    setDestinationPath(e.target.value)
                                }
                                className="flex-1 bg-transparent px-3 py-1 text-sm outline-none placeholder:text-muted-foreground h-full min-w-0"
                                placeholder="folder/filename"
                                autoComplete="off"
                            />
                            {isFile && extension && (
                                <div className="px-3 py-1 text-sm text-muted-foreground bg-muted/30 h-full flex items-center border-l shrink-0 select-none">
                                    .{extension}
                                </div>
                            )}
                        </div>
                        <p className="text-[0.8rem] text-muted-foreground">
                            Enter the relative path to save this item. Folders
                            will be created automatically.
                        </p>
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={loading || !destinationPath}
                    >
                        {loading ? 'Downloading...' : 'Download'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
