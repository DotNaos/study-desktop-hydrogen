import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import path from "path";

// Define roots correctly based on repo structure
// __dirname: .../apps/electron/study-sync
// workspace: .../apps/electron/study-sync/../../../ -> .../workspace
// aryazosDev: .../apps/electron/study-sync/../../../../aryazos-dev
const workspaceRoot = path.resolve(__dirname, "../../..");
const aryazosDevRoot = path.resolve(__dirname, "../../../../aryazos-dev");

const tailwindCssPath = (() => {
  const candidates = [
    path.resolve(__dirname, "node_modules/tailwindcss/index.css"),
    path.resolve(aryazosDevRoot, "node_modules/tailwindcss/index.css"),
    path.resolve(workspaceRoot, "node_modules/tailwindcss/index.css"),
  ];

  return candidates.find((candidate) => existsSync(candidate));
})();

// Simple copy function for resources
function copyResources() {
  return {
    name: "copy-resources",
    closeBundle() {
      const srcDir = path.resolve(__dirname, "resources");
      const destDir = path.resolve(__dirname, "out/main/resources");

      if (!existsSync(srcDir)) return;

      mkdirSync(destDir, { recursive: true });

      for (const file of readdirSync(srcDir)) {
        copyFileSync(path.join(srcDir, file), path.join(destDir, file));
      }
      console.log("[copy-resources] Copied resources to out/main/resources");
    }
  };
}

export default defineConfig({
    main: {
        plugins: [
            externalizeDepsPlugin({
                exclude: ['@aryazos/ts-base'],
            }),
            copyResources(),
        ],
        build: {
            sourcemap: true,
            rollupOptions: {
                external: [],
            },
            lib: {
                entry: path.resolve(__dirname, 'src/main/index.ts'),
            },
        },
        resolve: {
            alias: {
                '@main': path.resolve(__dirname, 'src/main'),
                '@': path.resolve(__dirname, 'src'),
            },
        },
    },
    preload: {
        build: {
            sourcemap: true,
        },
        plugins: [externalizeDepsPlugin()],
        resolve: {
            alias: {
                '@': path.resolve(__dirname, 'src'),
            },
        },
    },
    renderer: {
        root: path.resolve(__dirname, 'src/renderer'),
        build: {
            sourcemap: true,
            rollupOptions: {
                input: path.resolve(__dirname, 'src/renderer/index.html'),
            },
        },
        resolve: {
            alias: {
                '@': path.resolve(__dirname, 'src'),
                '@renderer': path.resolve(__dirname, 'src/renderer'),
                '@aryazos/ui': path.resolve(workspaceRoot, 'libs/ts-ui/src'),
                ...(tailwindCssPath ? { tailwindcss: tailwindCssPath } : {}),
            },
            dedupe: ['react', 'react-dom'],
        },
        server: {
            fs: {
                allow: [workspaceRoot, aryazosDevRoot],
            },
        },
        plugins: [react(), tailwindcss()],
    },
});
