/// <reference types="vite/client" />

interface Window {
  studySync?: {
    getTheme: () => Promise<boolean>;
    setTheme: (isDark: boolean) => Promise<void>;
    onThemeChanged: (callback: (isDark: boolean) => void) => () => void;
  };
}
