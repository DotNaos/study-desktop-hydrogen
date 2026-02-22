import { ExternalLink, Loader2, Save, Share2 } from 'lucide-react';
import type { ExportMode } from './types';

function GoodnotesIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <rect
                x="2"
                y="2"
                width="20"
                height="20"
                rx="4"
                stroke="currentColor"
                strokeWidth="1.5"
            />
            <path
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                d="M6 8h8 M6 12h5"
            />
            <path
                fill="currentColor"
                d="M14 6l4 10-2.5.5zm1 10.5c0 2-3 2-4 2s-3-1-3-3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
            <path d="M14 6l4 10-2.5.5z" fill="currentColor" />
            <path
                d="M8 15.5c0 2 3 2 4 2s3-1 3-3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
        </svg>
    );
}

interface ExportDialogProps {
    nodeName: string;
    isFolder: boolean;
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
    nodeName,
    isFolder,
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
            <div className="w-full max-w-lg rounded-xl border border-neutral-700 bg-neutral-900 p-5">
                <h2 className="text-lg font-semibold">Exportieren</h2>
                <p className="mt-1 text-sm text-neutral-400">{nodeName}</p>

                {exportError && (
                    <p className="mt-3 text-sm text-rose-400">{exportError}</p>
                )}

                <div className="mt-4 space-y-2">
                    <button
                        type="button"
                        disabled={exportMode !== null}
                        onClick={onSaveAs}
                        className="w-full rounded-lg border border-neutral-700 px-3 py-2 text-sm text-left hover:bg-neutral-800 disabled:opacity-60"
                    >
                        <div className="font-medium flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <Save className="h-4 w-4" />
                                Speichern unter...
                            </span>
                            {exportMode === 'saveAs' && (
                                <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
                            )}
                        </div>
                        <div className="text-xs text-neutral-400 mt-0.5">
                            {isFolder
                                ? 'Ordner lokal speichern'
                                : 'Datei lokal speichern'}
                        </div>
                    </button>

                    <button
                        type="button"
                        disabled={exportMode !== null}
                        onClick={onShare}
                        className="w-full rounded-lg border border-neutral-700 px-3 py-2 text-sm text-left hover:bg-neutral-800 disabled:opacity-60"
                    >
                        <div className="font-medium flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <Share2 className="h-4 w-4" />
                                Teilen...
                            </span>
                            {exportMode === 'share' && (
                                <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
                            )}
                        </div>
                        <div className="text-xs text-neutral-400 mt-0.5">
                            Mit anderen Apps oder Personen teilen
                        </div>
                    </button>

                    <button
                        type="button"
                        disabled={exportMode !== null}
                        onClick={onOpenWith}
                        className="w-full rounded-lg border border-neutral-700 px-3 py-2 text-sm text-left hover:bg-neutral-800 disabled:opacity-60"
                    >
                        <div className="font-medium flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <ExternalLink className="h-4 w-4" />
                                Öffnen mit...
                            </span>
                            {exportMode === 'openWith' && (
                                <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
                            )}
                        </div>
                        <div className="text-xs text-neutral-400 mt-0.5">
                            In einer bestimmten App öffnen
                        </div>
                    </button>

                    <button
                        type="button"
                        disabled={goodnotesDisabled}
                        onClick={onOpenGoodnotes}
                        className="w-full rounded-lg border border-neutral-700 px-3 py-2 text-sm text-left hover:bg-neutral-800 disabled:opacity-60"
                    >
                        <div className="font-medium flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <GoodnotesIcon className="h-4 w-4" />
                                In GoodNotes öffnen
                            </span>
                            {exportMode === 'openGoodnotes' && (
                                <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
                            )}
                        </div>
                        <div className="text-xs text-neutral-400 mt-0.5">
                            {!goodnotesAvailable
                                ? 'GoodNotes ist nicht installiert'
                                : 'Direkt in GoodNotes importieren'}
                        </div>
                    </button>
                </div>

                <div className="mt-4 flex justify-end">
                    <button
                        type="button"
                        disabled={exportMode !== null}
                        onClick={onClose}
                        className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800 disabled:opacity-60"
                    >
                        Schließen
                    </button>
                </div>
            </div>
        </div>
    );
}
