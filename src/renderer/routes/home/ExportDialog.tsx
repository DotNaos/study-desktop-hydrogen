import { Share2 } from 'lucide-react';
import type { ExportMode } from './types';

interface ExportDialogProps {
    nodeName: string;
    exportMode: ExportMode | null;
    exportError: string | null;
    onSaveAs: () => void;
    onShare: () => void;
    onClose: () => void;
}

export function ExportDialog({
    nodeName,
    exportMode,
    exportError,
    onSaveAs,
    onShare,
    onClose,
}: ExportDialogProps) {
    return (
        <div className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center px-4">
            <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-5">
                <h2 className="text-lg font-semibold">Exportieren</h2>
                <p className="mt-1 text-sm text-slate-400">{nodeName}</p>

                {exportError && (
                    <p className="mt-3 text-sm text-rose-400">{exportError}</p>
                )}

                <div className="mt-4 space-y-2">
                    <button
                        type="button"
                        disabled={exportMode !== null}
                        onClick={onSaveAs}
                        className="w-full rounded-lg border border-slate-700 px-3 py-2 text-sm text-left hover:bg-slate-800 disabled:opacity-60"
                    >
                        <div className="font-medium">Save As</div>
                        <div className="text-xs text-slate-400">
                            Ungezippt in ausgewählten Zielordner exportieren
                        </div>
                    </button>

                    <button
                        type="button"
                        disabled={exportMode !== null}
                        onClick={onShare}
                        className="w-full rounded-lg border border-slate-700 px-3 py-2 text-sm text-left hover:bg-slate-800 disabled:opacity-60"
                    >
                        <div className="font-medium flex items-center gap-2">
                            <Share2 className="h-4 w-4" />
                            Share
                        </div>
                        <div className="text-xs text-slate-400">
                            ZIP erstellen und macOS Share-Dialog öffnen
                        </div>
                    </button>
                </div>

                <div className="mt-4 flex justify-end">
                    <button
                        type="button"
                        disabled={exportMode !== null}
                        onClick={onClose}
                        className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800 disabled:opacity-60"
                    >
                        Schließen
                    </button>
                </div>
            </div>
        </div>
    );
}
