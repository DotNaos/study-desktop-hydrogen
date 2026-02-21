import { X } from 'lucide-react';
import { cn } from '../../shared/lib/utils';

export interface ToastItem {
    id: string;
    message: string;
    tone: 'success' | 'error';
}

interface ToastStackProps {
    toasts: ToastItem[];
    onDismiss: (id: string) => void;
}

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
    if (toasts.length === 0) {
        return null;
    }

    return (
        <div className="fixed right-4 bottom-4 z-50 flex max-w-sm flex-col gap-2 pointer-events-none">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={cn(
                        'pointer-events-auto rounded-lg border px-3 py-2 shadow-lg backdrop-blur-sm',
                        toast.tone === 'error'
                            ? 'border-rose-700/60 bg-rose-950/85 text-rose-100'
                            : 'border-emerald-700/60 bg-emerald-950/85 text-emerald-100',
                    )}
                >
                    <div className="flex items-start gap-2">
                        <p className="text-sm leading-snug flex-1">{toast.message}</p>
                        <button
                            type="button"
                            onClick={() => onDismiss(toast.id)}
                            className="rounded p-0.5 text-current/70 hover:bg-black/20 hover:text-current"
                            aria-label="Toast schließen"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}
