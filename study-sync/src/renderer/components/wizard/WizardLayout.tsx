import { Button } from '@aryazos/ui/shadcn';
import { Database } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DrilldownView } from './DrilldownView';
import { IgnoreDialog } from './IgnoreDialog';
import { LocalStackView } from './LocalStackView';
import { MappingTreeEditor, type MappingTreeNode } from './MappingTreeEditor';
import { RemoteStackPanel } from './RemoteStackPanel';
import { useIgnoreRules } from './useIgnoreRules';
import { useWizard } from './useWizard';
import { WizardSidebar, type WizardTab } from './WizardSidebar';

type WizardLayoutProps = {
    darkMode: boolean;
    onToggleTheme: () => void;
    onChooseFolder: () => void;
    onRevealFolder: () => void;
    canReveal: boolean;
};

export function WizardLayout({
    darkMode,
    onToggleTheme,
    onChooseFolder,
    onRevealFolder,
    canReveal,
}: WizardLayoutProps) {
    const wizard = useWizard();
    const [activeTab, setActiveTab] = useState<WizardTab>('local');
    const [showResolved, setShowResolved] = useState(false);
    const [showIgnoreDialog, setShowIgnoreDialog] = useState(false);
    const [ignoreTarget, setIgnoreTarget] = useState<{
        path: string;
        name: string;
        isFolder: boolean;
    } | null>(null);

    const { isPathIgnored } = useIgnoreRules(wizard.ignoreRules);

    const selectedItem = wizard.localStack.find(
        (item) => item.path === wizard.selectedStackItem,
    );

    const handleIgnore = (item: {
        path: string;
        name: string;
        isFolder: boolean;
    }) => {
        setIgnoreTarget(item);
        setShowIgnoreDialog(true);
    };

    const handleIgnoreSubmit = (rule: any) => {
        wizard.addIgnoreRule(rule);
        setShowIgnoreDialog(false);
        setIgnoreTarget(null);
    };

    const handleTabSelect = (tab: WizardTab) => {
        if (tab === activeTab) {
            // If clicking the active tab
            if (tab === 'local' && wizard.selectedStackItem) {
                // Go back to list if in drilldown
                wizard.selectStackItem(null);
            }
        } else {
            setActiveTab(tab);
        }
    };

    // --- Mappings Data Adapter ---
    const mappingNodes = useMemo(() => {
        const roots: MappingTreeNode[] = [];
        const nodeMap = new Map<string, MappingTreeNode>();

        const getOrCreateNode = (
            path: string,
            isFolder: boolean,
        ): MappingTreeNode => {
            if (nodeMap.has(path)) return nodeMap.get(path)!;

            const parts = path.split('/');
            const name = parts[parts.length - 1];

            // Check properties
            const mapping = wizard.mappings.get(path);
            const ignored = isPathIgnored(path, name);

            const node: MappingTreeNode = {
                id: path,
                localPath: path,
                localName: name,
                remoteId: mapping || '',
                remoteName: mapping || '',
                isFolder: isFolder,
                isIgnored: !!ignored,
                children: [],
            };
            nodeMap.set(path, node);

            // Link to parent
            if (parts.length > 1) {
                const parentPath = parts.slice(0, -1).join('/');
                const parentNode = getOrCreateNode(parentPath, true);
                parentNode.children!.push(node);
            } else {
                roots.push(node);
            }

            return node;
        };

        // 1. Add all mapped items
        // Sort paths to ensure deterministic tree building order
        const sortedMappedPaths = Array.from(wizard.mappings.keys()).sort();
        for (const path of sortedMappedPaths) {
            // Should we determine isFolder?
            // If it's in mappings, we don't strictly know if it's folder/file just from map unless we look at scan or infer.
            // Existing logic inferred from scan.
            const isScanFolder = wizard.scan?.folders.includes(path);
            // If scan is missing, assume file? Or folder if it has children later?
            // getOrCreateNode handles creating parents as folders.
            // For the leaf itself:
            const isFolder = isScanFolder || false; // Default to file if unknown?
            // Actually, if it has children it will be treated as folder implicitly by usage?
            // But type property matters.
            // Let's assume file unless we know it's a folder.
            getOrCreateNode(path, !!isScanFolder);
        }

        // 2. Add ignored items from scan
        if (wizard.scan) {
            // Folders
            wizard.scan.folders.forEach((path) => {
                if (nodeMap.has(path)) return; // Already processed
                const name = path.split('/').pop() || '';
                if (isPathIgnored(path, name)) {
                    getOrCreateNode(path, true);
                }
            });

            // Files
            wizard.scan.files.forEach((file) => {
                if (nodeMap.has(file.relativePath)) return;
                if (isPathIgnored(file.relativePath, file.name)) {
                    getOrCreateNode(file.relativePath, false);
                }
            });
        }

        // Sort children
        const sortNodes = (nodes: MappingTreeNode[]) => {
            nodes.sort((a, b) => {
                if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
                return a.localName.localeCompare(b.localName);
            });
            nodes.forEach((n) => {
                if (n.children) sortNodes(n.children);
            });
        };
        sortNodes(roots);

        return roots;
    }, [wizard.mappings, wizard.scan, isPathIgnored]);

    // Content Renderer
    const renderContent = () => {
        if (!wizard.rootPath) {
            return (
                <div className="flex flex-col items-center justify-center h-full p-8 text-muted-foreground">
                    <Database className="w-12 h-12 mb-4 opacity-40" />
                    <p className="text-lg font-medium">
                        No export folder selected
                    </p>
                    <div className="flex gap-2 mt-4">
                        <Button variant="default" onClick={onChooseFolder}>
                            Choose Folder
                        </Button>
                    </div>
                </div>
            );
        }

        if (activeTab === 'local') {
            if (wizard.selectedStackItem && selectedItem && wizard.scan) {
                return (
                    <DrilldownView
                        selectedItem={selectedItem}
                        scan={wizard.scan}
                        mappings={wizard.mappings}
                        predictions={wizard.predictions}
                        ignoreRules={wizard.ignoreRules}
                        onBack={() => wizard.selectStackItem(null)}
                        onAcceptPrediction={(path, remoteId) =>
                            wizard.acceptPrediction(path, remoteId, path)
                        }
                        onAddIgnoreRule={wizard.addIgnoreRule}
                        fetchPredictions={wizard.fetchPredictions}
                    />
                );
            }
            return (
                <LocalStackView
                    localStack={wizard.localStack}
                    showResolved={showResolved}
                    setShowResolved={setShowResolved}
                    isPathIgnored={isPathIgnored}
                    onSelectItem={wizard.selectStackItem}
                    onIgnoreItem={handleIgnore}
                    onIndexRemote={wizard.indexRemote}
                    onRefresh={wizard.loadData}
                    onClearAll={wizard.clearAllData}
                    loading={wizard.loading}
                    error={wizard.error}
                    onDismissError={() => wizard.setError(null)}
                />
            );
        }

        if (activeTab === 'remote') {
            return (
                <RemoteStackPanel
                    mappings={wizard.mappings}
                    ignoreRules={wizard.ignoreRules}
                    onDownloadComplete={wizard.refreshMappings}
                    onIgnore={handleIgnore}
                />
            );
        }

        if (activeTab === 'mappings') {
            return (
                <MappingTreeEditor
                    mappings={mappingNodes}
                    onRename={wizard.renameFile}
                    onRemove={(path) =>
                        wizard.removeMapping(wizard.mappings.get(path)!)
                    }
                    onDownload={() => {}}
                />
            );
        }
    };

    return (
        <div className="flex h-full">
            <WizardSidebar
                activeTab={activeTab}
                onSelectTab={handleTabSelect}
                localCount={
                    wizard.localStack.filter(
                        (i) => !i.resolved && !isPathIgnored(i.path, i.name),
                    ).length
                }
                mappingCount={wizard.mappings.size}
                remoteCount={0}
                darkMode={darkMode}
                onToggleTheme={onToggleTheme}
                onChooseFolder={onChooseFolder}
                onRevealFolder={onRevealFolder}
                canReveal={canReveal}
            />

            <div className="flex-1 min-w-0 bg-background">
                {renderContent()}
            </div>

            {/* Ignore dialog */}
            {showIgnoreDialog && ignoreTarget && (
                <IgnoreDialog
                    localName={ignoreTarget.name}
                    localPath={ignoreTarget.path}
                    isFolder={ignoreTarget.isFolder}
                    fileExtension={ignoreTarget.name.split('.').pop()}
                    onSubmit={handleIgnoreSubmit}
                    onClose={() => {
                        setShowIgnoreDialog(false);
                        setIgnoreTarget(null);
                    }}
                />
            )}
        </div>
    );
}
