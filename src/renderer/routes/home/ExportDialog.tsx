import { ExternalLink, Loader2, Save, Share2 } from 'lucide-react';
import type { ExportMode } from './types';

function GoodnotesIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="90 250 100 100" fill="currentColor" {...props}>
            <path d="M145.93,266.9H99.24c-2.7,0-3.4,0.7-3.4,3.4s0.7,3.4,3.4,3.4h46.69c2.7,0,3.4-0.7,3.4-3.4S148.63,266.9,145.93,266.9z" />
            <path d="M142.18,325.95c-1.18,1.08-7.43,6.38-15.37,4.92c-5.08-0.92-8.26-4.16-9.31-5.21c-5.08-5.18-5.59-11.69-5.59-14.23c0-1.52-0.98-2.86-2.45-3.3c-1.46-0.41-3.02,0.19-3.84,1.46c-1.27,2.06-2.89,3.78-4.8,5.15c-1.05,0.76-2.19,1.4-3.4,1.91c-2.48,1.08-2.86,2-1.78,4.48c1.05,2.48,2,2.86,4.48,1.78c1.65-0.7,3.24-1.59,4.7-2.64c0.48-0.35,0.95-0.7,1.4-1.08c1.02,3.56,2.89,7.59,6.45,11.21c1.43,1.43,5.72,5.84,12.93,7.15c1.37,0.25,2.67,0.35,3.97,0.35c9.15,0,15.85-5.69,17.25-6.96c2-1.81,2.03-2.83,0.22-4.8s-2.83-2.03-4.8-0.22L142.18,325.95z" />
            <path d="M137.35,290.47H99.24c-2.7,0-3.4,0.7-3.4,3.4c0,2.7,0.7,3.4,3.4,3.4h28.62h9.5c2.7,0,3.4-0.7,3.4-3.4C140.75,291.17,140.05,290.47,137.35,290.47z" />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M177.19,268.23c1.49-4.13-0.64-8.74-4.76-10.23s-8.74,0.64-10.23,4.76l-13.75,37.77c-0.48,1.33-0.7,2.76-0.67,4.16l0.41,13.25c0.06,2.22,2.8,3.21,4.29,1.56l8.83-9.88c0.95-1.05,1.68-2.29,2.16-3.62l13.75-37.77H177.19z"
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
