import { Download, Loader2, RefreshCw, RotateCcw, X } from 'lucide-react';
import type { UpdaterState } from '../../../shared/updater';
import { cn } from '../../shared/lib/utils';

interface UpdateStatusCardProps {
    state: UpdaterState | null;
    actionBusy: 'check' | 'download' | 'install' | null;
    onCheckForUpdates: () => void;
    onDownloadUpdate: () => void;
    onRestartToUpdate: () => void;
    onDismiss?: () => void;
}

function formatPercent(value: number | null): string | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return null;
    }
    return `${Math.round(value)}%`;
}

export function UpdateStatusCard({
    state,
    actionBusy,
    onCheckForUpdates,
    onDownloadUpdate,
    onRestartToUpdate,
    onDismiss,
}: UpdateStatusCardProps) {
    if (!state || !state.enabled) {
        return null;
    }

    if (
        state.stage === 'idle' ||
        state.stage === 'not-available' ||
        state.stage === 'unsupported'
    ) {
        return null;
    }

    const progress = formatPercent(state.progressPercent);

    return (
        <div className="fixed right-4 bottom-20 z-50 w-[min(420px,calc(100vw-2rem))] rounded-xl border border-neutral-700/80 bg-neutral-950/92 p-3 shadow-2xl backdrop-blur-md">
            <div className="flex items-start gap-3">
                <div
                    className={cn(
                        'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
                        state.stage === 'error'
                            ? 'border-rose-700/60 bg-rose-950/60 text-rose-300'
                            : state.stage === 'downloaded'
                              ? 'border-emerald-700/60 bg-emerald-950/60 text-emerald-300'
                              : 'border-neutral-700/80 bg-neutral-900/80 text-neutral-300',
                    )}
                >
                    {state.stage === 'checking' || state.stage === 'downloading' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : state.stage === 'downloaded' ? (
                        <RotateCcw className="h-4 w-4" />
                    ) : state.stage === 'error' ? (
                        <RefreshCw className="h-4 w-4" />
                    ) : (
                        <Download className="h-4 w-4" />
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-neutral-100">
                        {state.stage === 'checking' && 'Prüfe auf Updates'}
                        {state.stage === 'available' && 'Update verfügbar'}
                        {state.stage === 'downloading' && 'Update wird geladen'}
                        {state.stage === 'downloaded' && 'Update bereit'}
                        {state.stage === 'error' && 'Update fehlgeschlagen'}
                    </div>
                    <div className="mt-0.5 text-xs text-neutral-400">
                        {(state.stage === 'error'
                            ? state.error || state.message
                            : state.message) ??
                            (state.stage === 'downloaded'
                                ? `Version ${state.latestVersion ?? 'neu'} wurde geladen.`
                                : state.stage === 'available'
                                  ? `Version ${state.latestVersion ?? 'neu'} ist verfügbar.`
                                  : state.error ?? null)}
                    </div>

                    {state.stage === 'downloading' && (
                        <div className="mt-2">
                            <div className="h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                                <div
                                    className="h-full bg-blue-400 transition-[width] duration-150"
                                    style={{
                                        width: `${Math.max(
                                            0,
                                            Math.min(100, state.progressPercent ?? 0),
                                        )}%`,
                                    }}
                                />
                            </div>
                            <div className="mt-1 text-[11px] text-neutral-500">
                                {progress ? `Download ${progress}` : 'Download läuft...'}
                            </div>
                        </div>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        {state.stage === 'error' && (
                            <button
                                type="button"
                                onClick={onCheckForUpdates}
                                disabled={actionBusy === 'check'}
                                className="rounded-lg border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-800 disabled:opacity-50"
                            >
                                {actionBusy === 'check'
                                    ? 'Prüfe...'
                                    : 'Erneut prüfen'}
                            </button>
                        )}

                        {state.stage === 'available' && (
                            <button
                                type="button"
                                onClick={onDownloadUpdate}
                                disabled={actionBusy === 'download'}
                                className="rounded-lg border border-blue-700/70 bg-blue-950/60 px-2.5 py-1.5 text-xs font-medium text-blue-100 hover:bg-blue-900/60 disabled:opacity-50"
                            >
                                {actionBusy === 'download'
                                    ? 'Lade...'
                                    : 'Jetzt laden'}
                            </button>
                        )}

                        {state.stage === 'downloaded' && (
                            <button
                                type="button"
                                onClick={onRestartToUpdate}
                                disabled={actionBusy === 'install'}
                                className="rounded-lg border border-emerald-700/70 bg-emerald-950/60 px-2.5 py-1.5 text-xs font-medium text-emerald-100 hover:bg-emerald-900/60 disabled:opacity-50"
                            >
                                {actionBusy === 'install'
                                    ? 'Starte neu...'
                                    : 'Neustarten & updaten'}
                            </button>
                        )}

                        {(state.stage === 'checking' ||
                            state.stage === 'available' ||
                            state.stage === 'downloading') && (
                            <button
                                type="button"
                                onClick={onCheckForUpdates}
                                disabled={actionBusy === 'check'}
                                className="rounded-lg border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-xs font-medium text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
                            >
                                {actionBusy === 'check'
                                    ? 'Prüfe...'
                                    : 'Neu prüfen'}
                            </button>
                        )}
                    </div>
                </div>

                {onDismiss && (
                    <button
                        type="button"
                        onClick={onDismiss}
                        className="mt-0.5 shrink-0 rounded-md p-1 text-neutral-500 hover:bg-neutral-900/80 hover:text-neutral-300"
                        aria-label="Update-Hinweis schließen"
                        title="Für diese Sitzung ausblenden"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>
        </div>
    );
}
