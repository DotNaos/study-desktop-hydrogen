import type { ExportScan, RemoteNode } from "./types";

const port = new URLSearchParams(window.location.search).get("port") || "3333";
const apiBase = `http://localhost:${port}/api`;

const fetchJson = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(`${apiBase}${path}`, init);
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    const message = payload?.error || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return res.json();
};

export const exporterApi = {
  loadRoot: () => fetchJson<{ rootPath?: string }>("/export/root"),
  scanExport: () => fetchJson<ExportScan>("/export/scan", { method: "POST" }),
  loadRemoteRoot: () => fetchJson<RemoteNode[]>("/nodes"),
  loadChildren: (parentId: string) =>
    fetchJson<RemoteNode[]>(`/nodes/${encodeURIComponent(parentId)}/children`),
  renameExport: (oldPath: string, newPath: string) =>
    fetchJson("/export/rename", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldPath, newPath }),
    }),
  saveMapping: (remoteId: string, relativePath: string) =>
    fetchJson("/export/mappings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ remoteId, relativePath }),
    }),
  deleteMapping: (remoteId: string) =>
    fetchJson(`/export/mappings/${encodeURIComponent(remoteId)}`, { method: "DELETE" }),
  download: (remoteId: string, relativePath?: string) =>
    fetchJson("/export/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ remoteId, relativePath }),
    }),
};
