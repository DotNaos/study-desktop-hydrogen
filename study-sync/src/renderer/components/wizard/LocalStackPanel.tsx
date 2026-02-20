import { Check, ChevronRight, File, Folder } from "lucide-react";
import type { LocalStackItem } from "./types";

type LocalStackPanelProps = {
  items: LocalStackItem[];
  selectedPath: string | null;
  onSelect: (path: string | null) => void;
};

export function LocalStackPanel({ items, selectedPath, onSelect }: LocalStackPanelProps) {
  const unresolvedItems = items.filter((item) => !item.resolved);
  const resolvedItems = items.filter((item) => item.resolved);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
        <Folder className="w-12 h-12 mb-3 opacity-40" />
        <p className="text-sm">No local files to map</p>
        <p className="text-xs mt-1">Select a folder to start</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border bg-muted/30">
        <h2 className="text-sm font-medium">Local Stack</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {unresolvedItems.length} unresolved · {resolvedItems.length} mapped
        </p>
      </div>

      {/* Unresolved items */}
      {unresolvedItems.length > 0 && (
        <div className="flex-1 overflow-y-auto">
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Pending
          </div>
          {unresolvedItems.map((item) => (
            <StackItem
              key={item.path}
              item={item}
              isSelected={selectedPath === item.path}
              onSelect={() => onSelect(selectedPath === item.path ? null : item.path)}
            />
          ))}
        </div>
      )}

      {/* Resolved items */}
      {resolvedItems.length > 0 && (
        <div className="border-t border-border">
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Mapped
          </div>
          {resolvedItems.map((item) => (
            <StackItem
              key={item.path}
              item={item}
              isSelected={selectedPath === item.path}
              onSelect={() => onSelect(selectedPath === item.path ? null : item.path)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StackItem({
  item,
  isSelected,
  onSelect,
}: {
  item: LocalStackItem;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const Icon = item.isFolder ? Folder : File;

  return (
    <button
      onClick={onSelect}
      className={`
        w-full flex items-center gap-2 px-3 py-2 text-left
        transition-colors hover:bg-accent/50 cursor-pointer
        ${isSelected ? "bg-accent text-accent-foreground" : ""}
        ${item.resolved ? "opacity-60" : ""}
      `}
    >
      <Icon className="w-4 h-4 shrink-0 text-muted-foreground cursor-pointer" />
      <span className="flex-1 truncate text-sm cursor-pointer">{item.name}</span>
      {item.resolved ? (
        <Check className="w-4 h-4 text-primary shrink-0" />
      ) : (
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
      )}
    </button>
  );
}
