
import React from "react";

type IgnorePatternChipsProps = {
  localName: string;
  localPath: string;
  isFolder: boolean;
  fileExtension?: string;
  onSelectPattern: (pattern: string) => void;
};



export type PatternOption = {
  pattern: string;
  label: string;
  description?: string;
  display: 'main' | 'suggestion';
};

export function getIgnorePatterns(
  localName: string,
  localPath: string,
  _isFolder: boolean,
  fileExtension?: string
): PatternOption[] {
  const parts = localPath.split("/");
  const rootName = parts[0];
  const isDeep = parts.length > 1;

  const patterns: PatternOption[] = [
    {
      pattern: localPath,
      label: `Ignore "${localName}"`,
      description: "Only at this location",
      display: "main",
    },
    {
      pattern: `**/${localName}`,
      label: `Ignore all "${localName}"`,
      description: "Anywhere in the project",
      display: "main",
    },
  ];


  if (!fileExtension) {
      // It's a folder or file without extension
  } else {
    patterns.push({
      pattern: `**/*.${fileExtension}`,
      label: `Ignore all .${fileExtension} files`,
      display: "main",
    });
  }

  if (isDeep) {
    patterns.push({
      pattern: `${rootName}/**/${localName}`,
      label: `Ignore everywhere inside "${rootName}"`,
      display: "suggestion",
    });
  }

  return patterns;
}

export function IgnorePatternChips({
  localName,
  localPath,
  isFolder,
  fileExtension,
  onSelectPattern,
}: IgnorePatternChipsProps) {
  const patterns = getIgnorePatterns(localName, localPath, isFolder, fileExtension).filter(p => p.display === 'suggestion');

  if (patterns.length === 0) return null;

  const Chip = ({ children, pattern }: { children: React.ReactNode; pattern: string }) => (
    <button
      className="px-2 py-0.5 text-[10px] rounded-full border border-border bg-muted/50 hover:bg-muted transition-colors text-muted-foreground"
      onClick={(e) => {
        e.stopPropagation();
        onSelectPattern(pattern);
      }}
    >
      {children}
    </button>
  );


  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {patterns.map((p) => (
        <Chip key={p.pattern} pattern={p.pattern}>
          {p.label}
        </Chip>
      ))}
    </div>
  );
}
