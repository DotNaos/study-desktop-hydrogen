import { minimatch } from "minimatch";
import { useCallback } from "react";
import type { IgnoreRule } from "./types";

/**
 * Hook to derive ignored paths from ignore rules
 */
export function useIgnoreRules(ignoreRules: IgnoreRule[]) {
  const isPathIgnored = useCallback((path: string, _name: string): boolean => {
    // Check path and all parent paths against rules
    const segments = path.split("/");
    for (let i = segments.length; i >= 1; i--) {
      const subPath = segments.slice(0, i).join("/");

      for (const rule of ignoreRules) {
        if (minimatch(subPath, rule.pattern, { dot: true })) {
          return true;
        }
      }
    }
    return false;
  }, [ignoreRules]);

  return { isPathIgnored };
}
