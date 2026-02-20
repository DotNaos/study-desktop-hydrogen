import {
    Button,
    Checkbox,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Input,
} from '@aryazos/ui/shadcn';
import { Ban } from "lucide-react";
import { useState } from "react";
import { IgnorePatternChips, getIgnorePatterns } from "./IgnorePatternChips";

type IgnoreDialogProps = {
  localName: string;
  localPath: string;
  isFolder: boolean;
  fileExtension?: string;
  onSubmit: (rule: { pattern: string; createdAt: number }) => void;
  onClose: () => void;
};

export function IgnoreDialog({
  localName,
  localPath,
  isFolder,
  fileExtension,
  onSubmit,
  onClose,
}: IgnoreDialogProps) {
  const [pattern, setPattern] = useState(localPath);
  const [isCustomMode, setIsCustomMode] = useState(false);

  const handleSubmit = () => {
    onSubmit({
      pattern,
      createdAt: Date.now(),
    });
  };

  const options = getIgnorePatterns(localName, localPath, isFolder, fileExtension);
  const mainOptions = options.filter((o) => o.display === "main");

  // Determine if we are in custom mode effectively (explicit or no match)
  const matchedOption = mainOptions.find((o) => o.pattern === pattern);
  const showCustom = isCustomMode || !matchedOption;

  const handleSelectOption = (optPattern: string) => {
    setPattern(optPattern);
    setIsCustomMode(false);
  };

  const handleSelectCustom = () => {
    setIsCustomMode(true);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="w-4 h-4 text-destructive" />
            Ignore "{localName}"
          </DialogTitle>
          <DialogDescription>
            Choose how to ignore this {isFolder ? "folder" : "file"}:
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-4">
          {/* Main Presets */}
          {mainOptions.map((option) => {
            const isChecked = !showCustom && option.pattern === pattern;
            return (
              <div
                key={option.pattern}
                className={`flex items-start space-x-3 space-y-0 rounded-md border p-3 transition-colors cursor-pointer ${
                  isChecked
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50 bg-muted/10"
                }`}
                onClick={() => handleSelectOption(option.pattern)}
              >
                <Checkbox
                  id={option.pattern}
                  checked={isChecked}
                  onCheckedChange={() => handleSelectOption(option.pattern)}
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor={option.pattern}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {option.label}
                  </label>
                  {option.description && (
                    <p className="text-xs text-muted-foreground">{option.description}</p>
                  )}
                </div>
              </div>
            );
          })}

          {/* Custom Mode */}
          <div
            className={`flex flex-col rounded-md border transition-colors ${
              showCustom
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-muted/50 bg-muted/10"
            }`}
          >
            <div
              className="flex items-start space-x-3 space-y-0 p-3 cursor-pointer"
              onClick={handleSelectCustom}
            >
              <Checkbox
                id="custom_mode"
                checked={showCustom}
                onCheckedChange={handleSelectCustom}
                className="mt-0.5"
              />
              <div className="grid gap-1.5 leading-none">
                <label
                  htmlFor="custom_mode"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Custom pattern
                </label>
                {!showCustom && (
                  <p className="text-xs text-muted-foreground">
                    Matches <span className="font-mono">{pattern}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Expanded Drawer */}
            {showCustom && (
              <div className="px-3 pb-3 pt-0 pl-9">
                <Input
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  placeholder="e.g. **/node_modules/**"
                  className="font-mono text-sm h-8"
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="mt-2">
                  <span className="text-xs font-medium text-muted-foreground">Suggestions:</span>
                  <IgnorePatternChips
                    localName={localName}
                    localPath={localPath}
                    isFolder={isFolder}
                    fileExtension={fileExtension}
                    onSelectPattern={setPattern}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleSubmit}>
            Ignore
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
