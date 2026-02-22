import { ExternalLink, FolderIcon, Loader2, Save, Share2 } from 'lucide-react';
import type { ExplorerNode } from '../../app/treeUtils';
import { isFolderNode } from '../../app/treeUtils';
import type { ExportMode } from './types';

function GoodnotesIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            viewBox="0 0 128 128"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M37.8459 3.46436H90.1537C102.118 3.46436 106.438 4.71314 110.819 7.04957C115.2 9.386 118.624 12.8101 120.96 17.1909C123.297 21.5717 124.546 25.8921 124.546 37.8562V90.164C124.546 102.128 123.297 106.448 120.96 110.829C118.624 115.21 115.2 118.634 110.819 120.971C106.438 123.307 102.118 124.556 90.1537 124.556H37.8459C25.8818 124.556 21.5614 123.307 17.1806 120.971C12.7998 118.634 9.37574 115.21 7.03931 110.829C4.70288 106.448 3.4541 102.128 3.4541 90.164V37.8562C3.4541 25.8921 4.70288 21.5717 7.03931 17.1909C9.37574 12.8101 12.7998 9.386 17.1806 7.04957C21.5614 4.71314 25.8818 3.46436 37.8459 3.46436Z"
                fill="white"
            />
            <path
                d="M90.1841 128H37.8461C25.3079 128 20.5042 126.661 15.5493 124.002C10.5542 121.343 6.65681 117.446 3.99811 112.451C1.33942 107.496 0 102.692 0 90.1539V37.8461C0 25.3079 1.33942 20.5042 3.99811 15.5493C6.65681 10.5542 10.5542 6.65681 15.5493 3.99811C20.5042 1.33942 25.3079 0 37.8461 0H90.1539C102.692 0 107.496 1.33942 112.451 3.99811C117.446 6.65681 121.343 10.5542 124.002 15.5493C126.661 20.5042 128 25.3079 128 37.8461V90.1539C128 102.692 126.661 107.496 124.002 112.451C121.343 117.446 117.446 121.343 112.451 124.002C107.496 126.661 102.692 128 90.1539 128H90.1841ZM37.8461 6.87837C25.6906 6.87837 22.1659 8.25807 18.7821 10.0406C15.0055 12.0548 12.0648 14.9954 10.0507 18.772C8.25807 22.1356 6.88843 25.6806 6.88843 37.836V90.1438C6.88843 102.299 8.26814 105.824 10.0507 109.208C12.0648 112.984 15.0055 115.925 18.7821 117.939C22.1457 119.732 25.6906 121.101 37.8461 121.101H90.1539C102.309 121.101 105.824 119.722 109.218 117.939C112.994 115.925 115.935 112.984 117.949 109.208C119.742 105.844 121.112 102.299 121.112 90.1438V37.836C121.112 25.6806 119.732 22.1558 117.949 18.772C115.935 14.9954 112.994 12.0548 109.218 10.0406C105.854 8.24799 102.309 6.87837 90.1539 6.87837H37.8461Z"
                fill="#E6E5E3"
            />
            <path
                d="M77.5455 33.274H30.5249C27.8058 33.274 27.1008 33.9789 27.1008 36.698C27.1008 39.4171 27.8058 40.1221 30.5249 40.1221H77.5455C80.2646 40.1221 80.9696 39.4171 80.9696 36.698C80.9696 33.9789 80.2646 33.274 77.5455 33.274Z"
                fill="#48BEDB"
            />
            <path
                d="M73.7687 92.7421C72.5804 93.8297 66.2861 99.1673 58.2899 97.6969C53.1739 96.7704 49.9714 93.5075 48.914 92.45C43.798 87.2334 43.2844 80.6772 43.2844 78.1193C43.2844 76.5885 42.2975 75.239 40.817 74.7959C39.3467 74.383 37.7757 74.9872 36.9499 76.2662C35.6709 78.3408 34.0394 80.073 32.1159 81.4527C31.0584 82.2181 29.9104 82.8626 28.6918 83.3762C26.1942 84.4639 25.8115 85.3904 26.8992 87.888C27.9566 90.3855 28.9133 90.7682 31.4109 89.6806C33.0726 88.9756 34.6739 88.0793 36.1442 87.0219C36.6276 86.6694 37.1009 86.3169 37.5541 85.9342C38.5813 89.5194 40.4646 93.578 44.0498 97.2236C45.4899 98.6637 49.8103 103.105 57.0713 104.424C58.451 104.676 59.7602 104.777 61.0695 104.777C70.2842 104.777 77.0317 99.0464 78.4416 97.7674C80.4558 95.9446 80.486 94.9174 78.6631 92.9334C76.8403 90.9495 75.8131 90.8891 73.8292 92.7119L73.7687 92.7421Z"
                fill="#48BEDB"
            />
            <path
                d="M68.9048 57.0109H30.5249C27.8058 57.0109 27.1008 57.7158 27.1008 60.4349C27.1008 63.154 27.8058 63.859 30.5249 63.859H59.3476H68.9148C71.634 63.859 72.3389 63.154 72.3389 60.4349C72.3288 57.7158 71.6239 57.0109 68.9048 57.0109Z"
                fill="#48BEDB"
            />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M109.027 34.6134C110.527 30.4542 108.382 25.8115 104.233 24.3109C100.084 22.8104 95.4311 24.9555 93.9306 29.1047L80.0832 67.1421C79.5998 68.4815 79.3783 69.9217 79.4085 71.3316L79.8214 84.6754C79.8818 86.9111 82.6412 87.9081 84.1418 86.2464L93.0343 76.2965C93.991 75.239 94.7262 73.9903 95.2096 72.6508L109.057 34.6134H109.027Z"
                fill="#110D0C"
            />
        </svg>
    );
}

function PdfIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" {...props}>
            <path
                d="M4 4C4 2.89543 4.89543 2 6 2H14.1716C14.702 2 15.2107 2.21071 15.5858 2.58579L19.4142 6.41421C19.7893 6.78929 20 7.298 20 7.82843V20C20 21.1046 19.1046 22 18 22H6C4.89543 22 4 21.1046 4 20V4Z"
                fill="#EF4444"
            />
            <path
                d="M14 2V6.4C14 7.28366 14.7163 8 15.6 8H20L14 2Z"
                fill="#B91C1C"
            />
            <path
                d="M7 13.5H9.5C10.3284 13.5 11 14.1716 11 15C11 15.8284 10.3284 16.5 9.5 16.5H8V19H7V13.5ZM8 15.5H9.5C9.77614 15.5 10 15.2761 10 15C10 14.7239 9.77614 14.5 9.5 14.5H8V15.5ZM12 13.5H13.5C14.8807 13.5 16 14.6193 16 16C16 17.3807 14.8807 18.5 13.5 18.5H12V13.5ZM13 14.5V17.5H13.5C14.3284 17.5 15 16.8284 15 16C15 15.1716 14.3284 14.5 13.5 14.5H13ZM17 13.5H20V14.5H18V15.5H19.5V16.5H18V19H17V13.5Z"
                fill="white"
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
                className="flex items-center gap-2 py-2 px-2 hover:bg-neutral-800/50 rounded-md transition-colors group cursor-default"
                style={{ paddingLeft: `${depth * 1.5 + 0.5}rem` }}
            >
                {isFolder ? (
                    <FolderIcon className="w-5 h-5 text-blue-400 shrink-0" />
                ) : (
                    <PdfIcon className="w-5 h-5 shrink-0 shadow-sm" />
                )}
                <span className="text-sm font-medium text-neutral-200 truncate group-hover:text-white transition-colors ml-0.5">
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
                        className="rounded-full px-4 py-2 text-sm text-neutral-300 hover:text-white hover:bg-neutral-800 disabled:opacity-60 transition-colors"
                    >
                        Abbrechen
                    </button>

                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            type="button"
                            disabled={exportMode !== null}
                            onClick={onShare}
                            className="rounded-full border border-neutral-700 w-9 h-9 flex items-center justify-center text-neutral-200 hover:bg-neutral-800 disabled:opacity-60 transition-colors"
                            aria-label="Teilen"
                            title="Teilen"
                        >
                            {exportMode === 'share' ? (
                                <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
                            ) : (
                                <Share2 className="h-4 w-4" />
                            )}
                        </button>

                        <button
                            type="button"
                            disabled={exportMode !== null}
                            onClick={onOpenWith}
                            className="rounded-full border border-neutral-700 w-9 h-9 flex items-center justify-center text-neutral-200 hover:bg-neutral-800 disabled:opacity-60 transition-colors"
                            aria-label="Öffnen mit"
                            title="Öffnen mit"
                        >
                            {exportMode === 'openWith' ? (
                                <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
                            ) : (
                                <ExternalLink className="h-4 w-4" />
                            )}
                        </button>

                        <button
                            type="button"
                            disabled={exportMode !== null}
                            onClick={onSaveAs}
                            className="rounded-full border border-neutral-700 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-800 disabled:opacity-60 transition-colors flex items-center gap-2"
                        >
                            <Save className="h-4 w-4" />
                            Speichern unter
                            {exportMode === 'saveAs' && (
                                <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
                            )}
                        </button>

                        <button
                            type="button"
                            disabled={goodnotesDisabled}
                            onClick={onOpenGoodnotes}
                            className="rounded-full px-5 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2 bg-[#48BEDB] text-white hover:bg-[#3ca1ba] disabled:opacity-60 border-none ml-2 shadow-sm"
                        >
                            <GoodnotesIcon className="h-5 w-5" />
                            <span className="leading-none">
                                In GoodNotes öffnen
                            </span>
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
