import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("studySync", {
  getServerPort: () => ipcRenderer.invoke("study-sync:getPort"),
  login: () => ipcRenderer.invoke("study-sync:login"),
  getAuthStatus: () => ipcRenderer.invoke("study-sync:authStatus"),
  getTheme: () => ipcRenderer.invoke("study-sync:getTheme"),
  setTheme: (darkMode: boolean) => ipcRenderer.invoke("study-sync:setTheme", darkMode),
  onThemeChanged: (callback: (darkMode: boolean) => void) => {
    const listener = (_event: any, darkMode: boolean) => callback(darkMode);
    ipcRenderer.on("study-sync:theme-changed", listener);
    return () => ipcRenderer.removeListener("study-sync:theme-changed", listener);
  },
});
