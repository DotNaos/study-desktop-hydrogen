import { cn } from '@aryazos/ui/lib/utils';
import { Loader2 } from 'lucide-react';

type LoadingOverlayProps = {
    visible: boolean;
    fadeOut: boolean;
};

export function LoadingOverlay({ visible, fadeOut }: LoadingOverlayProps) {
    if (!visible) return null;

    return (
        <div
            className={cn(
                'fixed inset-0 z-50 flex items-center justify-center bg-background transition-opacity duration-300',
                fadeOut ? 'opacity-0' : 'opacity-100',
            )}
        >
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
        </div>
    );
}
