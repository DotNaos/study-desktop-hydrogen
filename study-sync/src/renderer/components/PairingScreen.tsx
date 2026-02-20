import { Wifi, WifiOff } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";

type NetworkInfo = {
  name: string;
  address: string;
  port: number;
};

export function PairingScreen() {
  const [network, setNetwork] = useState<NetworkInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const port = params.get("port") || "3333";
    const address = params.get("address");
    const interfaceName = params.get("interface") || "Network";

    if (address) {
      setNetwork({
        name: interfaceName,
        address,
        port: parseInt(port, 10),
      });
    }

    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-pulse text-zinc-500">Loading...</div>
      </div>
    );
  }

  if (!network) {
    return (
      <div className="h-screen w-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-8 select-none">
        {/* Drag region for macOS */}
        <div className="absolute top-0 left-0 right-0 h-7" style={{ WebkitAppRegion: "drag" } as React.CSSProperties} />

        <div className="flex flex-col items-center gap-4 text-center animate-in fade-in duration-300">
          <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center">
            <WifiOff className="w-8 h-8 text-zinc-500" />
          </div>
          <h1 className="text-xl font-semibold">No Connection</h1>
          <p className="text-sm text-zinc-400 max-w-[240px]">
            Could not detect any local network addresses. Connect to Wi-Fi and try again.
          </p>
        </div>
      </div>
    );
  }

  const url = `http://${network.address}:${network.port}`;

  return (
    <div className="h-screen w-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-8 select-none overflow-hidden">
      {/* Drag region for macOS */}
      <div className="absolute top-0 left-0 right-0 h-7" style={{ WebkitAppRegion: "drag" } as React.CSSProperties} />

      <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">Pair Mobile App</h1>
          <p className="text-sm text-zinc-400">Scan this code to connect</p>
        </div>

        {/* QR Code */}
        <div
          className="rounded-3xl overflow-hidden p-6 bg-white"
          style={{
            boxShadow: "0 0 0 1px rgba(255,255,255,0.1), 0 20px 40px -10px rgba(0,0,0,0.5)"
          }}
        >
          <QRCodeSVG
            value={url}
            size={280}
            level="M"
            bgColor="#ffffff"
            fgColor="#000000"
          />
        </div>

        {/* Network Info Pill */}
        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-full">
          <Wifi className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-300">
            {network.name}
          </span>
          <span className="text-xs font-mono text-zinc-400">
            {network.address}:{network.port}
          </span>
        </div>
      </div>
    </div>
  );
}
