import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@aryazos/ts-base/logging': path.resolve(
        __dirname,
        'src/shared/logging.ts',
      ),
      '@aryazos/study/types': path.resolve(
        __dirname,
        'src/shared/studyTypes.ts',
      ),
    },
  },
  test: {
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.vitest.ts'],
  },
});
