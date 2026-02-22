import {
    ExternalLink,
    FileIcon,
    FolderIcon,
    Loader2,
    Save,
    Share2,
} from 'lucide-react';
import type { ExplorerNode } from '../../app/treeUtils';
import { isFolderNode } from '../../app/treeUtils';
import type { ExportMode } from './types';

function GoodnotesIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 842 596" fill="none" {...props}>
            <g>
                <path
                    fill="#FFFFFF"
                    d="M106.51,237.3h51.94c11.88,0,16.17,1.24,20.52,3.56c4.35,2.32,7.75,5.72,10.07,10.07c2.32,4.35,3.56,8.64,3.56,20.52v51.94c0,11.88-1.24,16.17-3.56,20.52c-2.32,4.35-5.72,7.75-10.07,10.07c-4.35,2.32-8.64,3.56-20.52,3.56h-51.94c-11.88,0-16.17-1.24-20.52-3.56c-4.35-2.32-7.75-5.72-10.07-10.07c-2.32-4.35-3.56-8.64-3.56-20.52v-51.94c0-11.88,1.24-16.17,3.56-20.52c2.32-4.35,5.72-7.75,10.07-10.07S94.63,237.3,106.51,237.3z"
                />
                <path
                    fill="#E6E5E3"
                    d="M158.48,360.96h-51.97c-12.45,0-17.22-1.33-22.14-3.97c-4.96-2.64-8.83-6.51-11.47-11.47c-2.64-4.92-3.97-9.69-3.97-22.14v-51.94c0-12.45,1.33-17.22,3.97-22.14c2.64-4.96,6.51-8.83,11.47-11.47c4.92-2.64,9.69-3.97,22.14-3.97h51.94c12.45,0,17.22,1.33,22.14,3.97c4.96,2.64,8.83,6.51,11.47,11.47c2.64,4.92,3.97,9.69,3.97,22.14v51.94c0,12.45-1.33,17.22-3.97,22.14c-2.64,4.96-6.51,8.83-11.47,11.47c-4.92,2.64-9.69,3.97-22.14,3.97H158.48z M106.51,240.69c-12.07,0-15.57,1.37-18.93,3.14c-3.75,2-6.67,4.92-8.67,8.67c-1.78,3.34-3.14,6.86-3.14,18.93v51.94c0,12.07,1.37,15.57,3.14,18.93c2,3.75,4.92,6.67,8.67,8.67c3.34,1.78,6.86,3.14,18.93,3.14h51.94c12.07,0,15.56-1.37,18.93-3.14c3.75-2,6.67-4.92,8.67-8.67c1.78-3.34,3.14-6.86,3.14-18.93v-51.94c0-12.07-1.37-15.57-3.14-18.93c-2-3.75-4.92-6.67-8.67-8.67c-3.34-1.78-6.86-3.14-18.93-3.14C158.45,240.69,106.51,240.69,106.51,240.69z"
                />
            </g>
            <g>
                <path
                    fill="#48BEDB"
                    d="M145.93,266.9L145.93,266.9H99.24l0,0c-2.7,0-3.4,0.7-3.4,3.4s0.7,3.4,3.4,3.4l0,0h46.69l0,0c2.7,0,3.4-0.7,3.4-3.4S148.63,266.9,145.93,266.9z"
                />
                <path
                    fill="#48BEDB"
                    d="M142.18,325.95L142.18,325.95c-1.18,1.08-7.43,6.38-15.37,4.92c-5.08-0.92-8.26-4.16-9.31-5.21c-5.08-5.18-5.59-11.69-5.59-14.23c0-1.52-0.98-2.86-2.45-3.3c-1.46-0.41-3.02,0.19-3.84,1.46c-1.27,2.06-2.89,3.78-4.8,5.15c-1.05,0.76-2.19,1.4-3.4,1.91l0,0c-2.48,1.08-2.86,2-1.78,4.48c1.05,2.48,2,2.86,4.48,1.78l0,0c1.65-0.7,3.24-1.59,4.7-2.64c0.48-0.35,0.95-0.7,1.4-1.08c1.02,3.56,2.89,7.59,6.45,11.21c1.43,1.43,5.72,5.84,12.93,7.15c1.37,0.25,2.67,0.35,3.97,0.35c9.15,0,15.85-5.69,17.25-6.96l0,0c2-1.81,2.03-2.83,0.22-4.8s-2.83-2.03-4.8-0.22L142.18,325.95z"
                />
                <path
                    fill="#48BEDB"
                    d="M137.35,290.47L137.35,290.47L137.35,290.47H99.24c-2.7,0-3.4,0.7-3.4,3.4c0,2.7,0.7,3.4,3.4,3.4l0,0h28.62h9.5c2.7,0,3.4-0.7,3.4-3.4C140.75,291.17,140.05,290.47,137.35,290.47z"
                />
            </g>
            <path
                fill="#1F2937"
                fillRule="evenodd"
                clipRule="evenodd"
                d="M177.19,268.23c1.49-4.13-0.64-8.74-4.76-10.23s-8.74,0.64-10.23,4.76l-13.75,37.77c-0.48,1.33-0.7,2.76-0.67,4.16l0.41,13.25c0.06,2.22,2.8,3.21,4.29,1.56l8.83-9.88c0.95-1.05,1.68-2.29,2.16-3.62l13.75-37.77H177.19z"
            />
        </svg>
    );
}

function PreviewTree({
    node,
    depth = 0,
}: {
    node: ExplorerNode;
    depth?: number;
}) {
    const isFolder = isFolderNode(node);
    return (
        <div className="flex flex-col">
            <div
                className="flex items-center gap-2 py-1.5 px-2 hover:bg-neutral-800/50 rounded-md transition-colors"
                style={{ paddingLeft: `${depth * 1.5 + 0.5}rem` }}
            >
                {isFolder ? (
                    <FolderIcon className="w-4 h-4 text-blue-400 shrink-0" />
                ) : (
                    <FileIcon className="w-4 h-4 text-neutral-400 shrink-0" />
                )}
                <span className="text-sm font-medium text-neutral-200 truncate">
                    {node.name}
                </span>
            </div>
            {isFolder && node.children && (
                <div className="flex flex-col">
                    {node.children.map((child) => (
                        <PreviewTree
                            key={child.id}
                            node={child}
                            depth={depth + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

interface ExportDialogProps {
    node: ExplorerNode;
    goodnotesAvailable: boolean;
    exportMode: ExportMode | null;
    exportError: string | null;
    onSaveAs: () => void;
    onShare: () => void;
    onOpenWith: () => void;
    onOpenGoodnotes: () => void;
    onClose: () => void;
}

export function ExportDialog({
    node,
    goodnotesAvailable,
    exportMode,
    exportError,
    onSaveAs,
    onShare,
    onOpenWith,
    onOpenGoodnotes,
    onClose,
}: ExportDialogProps) {
    const goodnotesDisabled = !goodnotesAvailable || exportMode !== null;

    return (
        <div className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center px-4">
            <div className="w-full max-w-3xl rounded-xl border border-neutral-700 bg-neutral-900 flex flex-col h-[500px]">
                {/* Header */}
                <div className="px-5 py-4 border-b border-neutral-700 shrink-0 flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-semibold text-white">
                            Exportieren
                        </h2>
                        <p className="mt-0.5 text-sm text-neutral-400 truncate">
                            {node.name}
                        </p>
                    </div>
                </div>

                {exportError && (
                    <div className="px-5 py-3 bg-red-500/10 border-b border-red-500/20 shrink-0">
                        <p className="text-sm text-red-400">{exportError}</p>
                    </div>
                )}

                {/* Body - Tree Preview */}
                <div className="flex-1 overflow-y-auto px-3 py-3 relative bg-neutral-900/50">
                    <PreviewTree node={node} />
                </div>

                {/* Footer - Actions */}
                <div className="px-5 py-4 border-t border-neutral-700 shrink-0 bg-neutral-900 flex flex-wrap items-center justify-between gap-4">
                    <button
                        type="button"
                        disabled={exportMode !== null}
                        onClick={onClose}
                        className="rounded-lg px-4 py-2 text-sm text-neutral-300 hover:text-white hover:bg-neutral-800 disabled:opacity-60 transition-colors"
                    >
                        Abbrechen
                    </button>

                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            type="button"
                            disabled={exportMode !== null}
                            onClick={onSaveAs}
                            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-800 disabled:opacity-60 transition-colors flex items-center gap-2"
                        >
                            <Save className="h-4 w-4" />
                            Speichern unter
                            {exportMode === 'saveAs' && (
                                <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
                            )}
                        </button>

                        <button
                            type="button"
                            disabled={exportMode !== null}
                            onClick={onShare}
                            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-800 disabled:opacity-60 transition-colors flex items-center gap-2"
                        >
                            <Share2 className="h-4 w-4" />
                            Teilen
                            {exportMode === 'share' && (
                                <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
                            )}
                        </button>

                        <button
                            type="button"
                            disabled={exportMode !== null}
                            onClick={onOpenWith}
                            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-800 disabled:opacity-60 transition-colors flex items-center gap-2"
                        >
                            <ExternalLink className="h-4 w-4" />
                            Öffnen mit
                            {exportMode === 'openWith' && (
                                <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
                            )}
                        </button>

                        <button
                            type="button"
                            disabled={goodnotesDisabled}
                            onClick={onOpenGoodnotes}
                            className="rounded-lg px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 bg-[#48BEDB] text-white hover:bg-[#3ca1ba] disabled:opacity-60 border-none"
                        >
                            <GoodnotesIcon className="h-4 w-4" />
                            In GoodNotes öffnen
                            {exportMode === 'openGoodnotes' && (
                                <Loader2 className="h-4 w-4 animate-spin text-white" />
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
