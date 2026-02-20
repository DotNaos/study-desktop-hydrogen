import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';

function copyResources() {
    return {
        name: 'copy-resources',
        closeBundle() {
            const srcDir = path.resolve(__dirname, 'resources');
            const destDir = path.resolve(__dirname, 'out/main/resources');

            if (!existsSync(srcDir)) return;

            mkdirSync(destDir, { recursive: true });

            for (const file of readdirSync(srcDir)) {
                copyFileSync(path.join(srcDir, file), path.join(destDir, file));
            }
            console.log('[copy-resources] copied resources to out/main/resources');
        },
    };
}

const sharedAliases = {
    '@': path.resolve(__dirname, 'src'),
    '@main': path.resolve(__dirname, 'src/main'),
    '@shared': path.resolve(__dirname, 'src/shared'),
    '@aryazos/ts-base/logging': path.resolve(
        __dirname,
        'src/shared/logging.ts',
    ),
    '@aryazos/study/types': path.resolve(__dirname, 'src/shared/studyTypes.ts'),
};

export default defineConfig({
    main: {
        plugins: [externalizeDepsPlugin(), copyResources()],
        build: {
            sourcemap: true,
            lib: {
                entry: path.resolve(__dirname, 'src/main/index.ts'),
            },
        },
        resolve: {
            alias: sharedAliases,
        },
    },
    preload: {
        build: {
            sourcemap: true,
        },
        plugins: [externalizeDepsPlugin()],
        resolve: {
            alias: sharedAliases,
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
                ...sharedAliases,
                '@renderer': path.resolve(__dirname, 'src/renderer'),
            },
            dedupe: ['react', 'react-dom'],
        },
        plugins: [react(), tailwindcss()],
    },
});
