import {
    Button,
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@aryazos/ui/shadcn';
import { Cloud, FolderOpen, HardDrive, Link, Moon, Sun } from 'lucide-react';

export type WizardTab = 'local' | 'remote' | 'mappings';

type WizardSidebarProps = {
    activeTab: WizardTab;
    onSelectTab: (tab: WizardTab) => void;
    localCount?: number;
    remoteCount?: number;
    mappingCount?: number;
    // Global actions
    darkMode: boolean;
    onToggleTheme: () => void;
    onChooseFolder: () => void;
    onRevealFolder: () => void;
    canReveal: boolean;
};

export function WizardSidebar({
    activeTab,
    onSelectTab,
    localCount,
    remoteCount,
    mappingCount,
    darkMode,
    onToggleTheme,
    onChooseFolder,
    onRevealFolder,
    canReveal,
}: WizardSidebarProps) {
    return (
        <div className="w-16 border-r border-border bg-muted/10 flex flex-col items-center py-4 gap-4 flex-shrink-0">
            <SidebarButton
                isActive={activeTab === 'local'}
                onClick={() => onSelectTab('local')}
                icon={<HardDrive className="w-5 h-5" />}
                label="Local"
                badge={localCount}
            />
            <SidebarButton
                isActive={activeTab === 'remote'}
                onClick={() => onSelectTab('remote')}
                icon={<Cloud className="w-5 h-5" />}
                label="Remote"
                badge={remoteCount}
            />
            <SidebarButton
                isActive={activeTab === 'mappings'}
                onClick={() => onSelectTab('mappings')}
                icon={<Link className="w-5 h-5" />}
                label="Map"
                badge={mappingCount}
            />

            <div className="flex-1" />

            {/* Bottom Actions */}
            <TooltipProvider>
                <div className="flex flex-col gap-2">
                    <SidebarAction
                        onClick={onChooseFolder}
                        icon={<FolderOpen className="w-5 h-5" />}
                        label="Choose Folder"
                    />
                    <SidebarAction
                        onClick={onRevealFolder}
                        icon={<HardDrive className="w-5 h-5" />} // Using HardDrive or generic folder icon? FolderOpen used above. Reveal typically is "Show in Finder".
                        label="Reveal in Finder"
                        disabled={!canReveal}
                    />
                    <SidebarAction
                        onClick={onToggleTheme}
                        icon={
                            darkMode ? (
                                <Sun className="w-5 h-5" />
                            ) : (
                                <Moon className="w-5 h-5" />
                            )
                        }
                        label={darkMode ? 'Light Mode' : 'Dark Mode'}
                    />
                </div>
            </TooltipProvider>
        </div>
    );
}

function SidebarButton({
    isActive,
    onClick,
    icon,
    label,
    badge,
}: {
    isActive: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    badge?: number;
}) {
    return (
        <div className="flex flex-col items-center gap-1 group relative">
            <Button
                variant={isActive ? 'secondary' : 'ghost'}
                size="icon"
                onClick={onClick}
                className={`rounded-xl h-10 w-10 ${isActive ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'text-muted-foreground'}`}
                title={label}
            >
                {icon}
            </Button>
            <span
                className={`text-[10px] font-medium ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
            >
                {label}
            </span>
            {badge !== undefined && badge > 0 && (
                <span className="absolute top-0 right-0 translate-x-1/4 -translate-y-1/4 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold shadow-sm pointer-events-none">
                    {badge}
                </span>
            )}
        </div>
    );
}

function SidebarAction({
    onClick,
    icon,
    label,
    disabled,
}: {
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    disabled?: boolean;
}) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClick}
                    disabled={disabled}
                    className="rounded-xl h-10 w-10 text-muted-foreground hover:bg-muted"
                >
                    {icon}
                </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{label}</TooltipContent>
        </Tooltip>
    );
}
