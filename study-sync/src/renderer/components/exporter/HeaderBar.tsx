import { Button } from '@aryazos/ui/shadcn';
import { Moon, Sun } from 'lucide-react';

type HeaderBarProps = {
    darkMode: boolean;
    canReveal: boolean;
    onToggleTheme: () => void;
    onChooseFolder: () => void;
    onRevealFolder: () => void;
};

export function HeaderBar({
    darkMode,
    canReveal,
    onToggleTheme,
    onChooseFolder,
    onRevealFolder,
}: HeaderBarProps) {
    return (
        <header className="flex flex-wrap items-center justify-between gap-4">
            <div>
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                    Study Sync
                </p>
                <h1 className="text-3xl font-semibold">
                    Map remote files to your local structure.
                </h1>
            </div>
            <div className="flex items-center gap-3">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onToggleTheme}
                    className="rounded-full"
                >
                    {darkMode ? (
                        <Sun className="h-5 w-5" />
                    ) : (
                        <Moon className="h-5 w-5" />
                    )}
                </Button>
                <Button
                    variant="outline"
                    onClick={onChooseFolder}
                    className="border-border bg-card/70 hover:bg-card/90 cursor-pointer"
                >
                    Choose Folder
                </Button>
                <Button
                    variant="outline"
                    disabled={!canReveal}
                    onClick={onRevealFolder}
                    className="border-border bg-card/70 hover:bg-card/90 cursor-pointer"
                >
                    Reveal Folder
                </Button>
            </div>
        </header>
    );
}
