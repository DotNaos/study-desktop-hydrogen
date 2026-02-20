import tailwindcss from '@tailwindcss/vite';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import path from 'node:path';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig(({ mode }) => {
    const base = process.env.VITE_BASE ?? (mode === 'development' ? '/' : '/apps/study/')
    const apiProxyTarget = process.env.VITE_SYSTEM_API_PROXY ?? 'https://aryazos.localhost'

    return {
        base,
        plugins: [
            // @ts-ignore - version mismatch in types
            TanStackRouterVite(),
            tailwindcss(),
            tsconfigPaths({ projects: [path.resolve(__dirname, 'tsconfig.json')] }),
        ],
        build: {
            outDir: 'build/client',
            emptyOutDir: true,
        },
        server: {
            host: true,
            port: Number(process.env.VITE_DEV_PORT ?? 5174),
            strictPort: true,
            // When routing behind Traefik+TLS, Vite often needs explicit HMR settings.
            // `VITE_HMR_*` are set by the root `bun run dev` script.
            hmr: process.env.VITE_HMR_HOST
                ? {
                      host: process.env.VITE_HMR_HOST,
                      protocol: (process.env.VITE_HMR_PROTOCOL as 'ws' | 'wss') ?? 'wss',
                      clientPort: Number(process.env.VITE_HMR_CLIENT_PORT ?? 443),
                      path: base.replace(/\/$/, ''),
                  }
                : undefined,
            proxy: {
                '/api': {
                    target: apiProxyTarget,
                    changeOrigin: true,
                    secure: false,
                },
            },
        },
    };
});
