import { BrowserWindow } from "electron";
import os from "node:os";
import { join } from "path";
import { icon as appIcon, hasIcon } from "./appIcon";
import { registerDockWindow } from "./dock";

function getLanIpv4Addresses(): Array<{ name: string; address: string }> {
  const nets = os.networkInterfaces();
  const out: Array<{ name: string; address: string }> = [];

  for (const [name, infos] of Object.entries(nets)) {
    if (!infos) continue;
    for (const info of infos) {
      if (info.family !== "IPv4") continue;
      if (info.internal) continue;
      out.push({ name, address: info.address });
    }
  }

  // Prefer likely primary interfaces first
  const preferred = ["en0", "en1", "Wi-Fi", "Ethernet"];
  out.sort((a, b) => {
    const ai = preferred.findIndex((p) => a.name.toLowerCase().includes(p.toLowerCase()));
    const bi = preferred.findIndex((p) => b.name.toLowerCase().includes(p.toLowerCase()));
    const ap = ai === -1 ? 999 : ai;
    const bp = bi === -1 ? 999 : bi;
    if (ap !== bp) return ap - bp;
    return a.address.localeCompare(b.address);
  });

  // De-dupe addresses
  const seen = new Set<string>();
  return out.filter((x) => {
    if (seen.has(x.address)) return false;
    seen.add(x.address);
    return true;
  });
}

let pairingWindow: BrowserWindow | null = null;
const hasAppIcon = hasIcon;

export function openMobilePairingWindow(port: number): void {
  if (pairingWindow) {
    pairingWindow.focus();
    return;
  }

  const addrs = getLanIpv4Addresses();
  const best = addrs.length > 0 ? addrs[0] : null;

  // Build query params for the renderer
  const query = new URLSearchParams();
  query.set("view", "pairing");
  query.set("port", String(port));

  if (best) {
    query.set("address", best.address);
    query.set("interface", best.name);
  }

  pairingWindow = new BrowserWindow({
    width: 400,
    height: 600,
    title: "Pair Device",
    resizable: false,
    minimizable: true,
    maximizable: false,
    titleBarStyle: "hiddenInset",
    vibrancy: "under-window",
    visualEffectState: "active",
    backgroundColor: "#00000000",
    ...(hasAppIcon ? { icon: appIcon } : {}),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(__dirname, "../preload/index.js"),
    },
  });
  registerDockWindow(pairingWindow);

  pairingWindow.on("closed", () => {
    pairingWindow = null;
  });

  const devUrl = process.env["ELECTRON_RENDERER_URL"];
  if (devUrl) {
    pairingWindow.loadURL(`${devUrl}?${query.toString()}`);
  } else {
    pairingWindow.loadFile(join(__dirname, "../renderer/index.html"), {
      search: query.toString(),
    });
  }
}
