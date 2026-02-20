import {
    Button,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    Input,
} from '@aryazos/ui/shadcn';
import { ChevronDown, ChevronRight, File, Folder, RefreshCw, Search } from "lucide-react";
import { useCallback, useState } from "react";

type SearchModalProps = {
  open: boolean;
  localPath: string;
  localName: string;
  onClose: () => void;
  onSelect: (nodeId: string) => void;
};

export function SearchModal({ open, localPath, localName, onClose, onSelect }: SearchModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [remoteNodes, setRemoteNodes] = useState<any[]>([]);
  const [expandedRemote, setExpandedRemote] = useState<Set<string>>(new Set());
  const [loadedChildren, setLoadedChildren] = useState<Map<string, any[]>>(new Map());
  const [loadingNodes, setLoadingNodes] = useState<Set<string>>(new Set());

  // Fetch remote nodes for search
  const fetchRemoteNodes = useCallback(async () => {
    try {
      const port = new URLSearchParams(window.location.search).get("port") || "3333";
      const res = await fetch(`http://localhost:${port}/api/nodes`);
      if (res.ok) {
        const nodes = await res.json();
        setRemoteNodes(nodes);
      }
    } catch (err) {
      console.error("Failed to fetch remote nodes:", err);
    }
  }, []);

  // Build remote tree
  const remoteTree = (() => {
    const roots: any[] = [];
    const byId = new Map<string, any>();

    for (const node of remoteNodes) {
      byId.set(node.id, { ...node, children: [] });
    }

    for (const node of remoteNodes) {
      const n = byId.get(node.id);
      if (node.parent && byId.has(node.parent)) {
        byId.get(node.parent).children.push(n);
      } else {
        roots.push(n);
      }
    }

    return roots;
  })();

  // Filter remote tree by search
  const filterTree = (nodes: any[], query: string): any[] => {
    if (!query.trim()) return nodes;
    const q = query.toLowerCase();
    return nodes.filter((n) => {
      const match = n.name?.toLowerCase().includes(q);
      const childMatch = filterTree(n.children || [], query).length > 0;
      return match || childMatch;
    });
  };

  const filteredRemoteTree = filterTree(remoteTree, searchQuery);

  // Fetch children for a node
  const fetchChildren = useCallback(async (nodeId: string) => {
    if (loadedChildren.has(nodeId) || loadingNodes.has(nodeId)) return;

    setLoadingNodes((prev) => new Set(prev).add(nodeId));
    try {
      const port = new URLSearchParams(window.location.search).get("port") || "3333";
      const res = await fetch(`http://localhost:${port}/api/nodes/${encodeURIComponent(nodeId)}/children`);
      if (res.ok) {
        const children = await res.json();
        setLoadedChildren((prev) => new Map(prev).set(nodeId, children));
      }
    } catch (err) {
      console.error("Failed to fetch children:", err);
    } finally {
      setLoadingNodes((prev) => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
    }
  }, [loadedChildren, loadingNodes]);

  // Toggle remote expansion with lazy load
  const toggleRemoteNode = useCallback(async (nodeId: string, isFolder: boolean) => {
    if (isFolder && !loadedChildren.has(nodeId)) {
      await fetchChildren(nodeId);
    }
    setExpandedRemote((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, [fetchChildren, loadedChildren]);

  // Load nodes on open
  if (open && remoteNodes.length === 0) {
    fetchRemoteNodes();
  }

  // Render remote tree node with lazy children
  const renderRemoteNode = (node: any, depth = 0): React.ReactNode => {
    const isFolder = node.type === "folder" || node.type === "group";
    const isExpanded = expandedRemote.has(node.id);
    const isLoading = loadingNodes.has(node.id);
    const children = loadedChildren.get(node.id) || [];
    const Icon = isFolder ? Folder : File;

    return (
      <div key={node.id}>
        <div
          className="flex items-center gap-1 px-3 py-1.5 hover:bg-accent/50"
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          {isFolder ? (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => toggleRemoteNode(node.id, true)}
              disabled={isLoading}
              className="h-6 w-6"
            >
              {isLoading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </Button>
          ) : (
            <div className="w-6" />
          )}
          <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="flex-1 text-sm truncate">{node.name}</span>
          <Button
            size="sm"
            onClick={() => onSelect(node.id)}
          >
            Select
          </Button>
        </div>
        {isExpanded && children.map((c: any) => renderRemoteNode(c, depth + 1))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl h-[80dvh] flex flex-col p-0">
        <DialogHeader className="px-4 py-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <span className="text-xs text-muted-foreground uppercase">Mapping:</span>
            {localName}
          </DialogTitle>
        </DialogHeader>

        <div className="px-4 py-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Moodle..."
              autoFocus
              className="pl-8"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {filteredRemoteTree.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {remoteNodes.length === 0 ? "Loading..." : "No matches"}
            </div>
          ) : (
            filteredRemoteTree.map((node) => renderRemoteNode(node))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
