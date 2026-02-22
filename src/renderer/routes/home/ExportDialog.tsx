import { ExternalLink, Share2 } from 'lucide-react';
import type { ExportMode } from './types';

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
    const goodnotesDisabled =
        !goodnotesAvailable || isFolder || exportMode !== null;

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
                        <div className="font-medium">Save As</div>
                        <div className="text-xs text-neutral-400">
                            Ungezippt in ausgewählten Zielordner exportieren
                        </div>
                    </button>

                    <button
                        type="button"
                        disabled={exportMode !== null}
                        onClick={onShare}
                        className="w-full rounded-lg border border-neutral-700 px-3 py-2 text-sm text-left hover:bg-neutral-800 disabled:opacity-60"
                    >
                        <div className="font-medium flex items-center gap-2">
                            <Share2 className="h-4 w-4" />
                            Share
                        </div>
                        <div className="text-xs text-neutral-400">
                            ZIP erstellen und macOS Share-Dialog öffnen
                        </div>
                    </button>

                    <button
                        type="button"
                        disabled={exportMode !== null}
                        onClick={onOpenWith}
                        className="w-full rounded-lg border border-neutral-700 px-3 py-2 text-sm text-left hover:bg-neutral-800 disabled:opacity-60"
                    >
                        <div className="font-medium flex items-center gap-2">
                            <ExternalLink className="h-4 w-4" />
                            Open With...
                        </div>
                        <div className="text-xs text-neutral-400">
                            App auswählen und Export direkt darin öffnen
                        </div>
                    </button>

                    <button
                        type="button"
                        disabled={goodnotesDisabled}
                        onClick={onOpenGoodnotes}
                        className="w-full rounded-lg border border-neutral-700 px-3 py-2 text-sm text-left hover:bg-neutral-800 disabled:opacity-60"
                    >
                        <div className="font-medium">Open in Goodnotes</div>
                        <div className="text-xs text-neutral-400">
                            {!goodnotesAvailable
                                ? 'Goodnotes ist nicht installiert'
                                : isFolder
                                  ? 'Nur für einzelne PDF-Ressourcen verfügbar'
                                  : 'Direkt in Goodnotes öffnen'}
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
