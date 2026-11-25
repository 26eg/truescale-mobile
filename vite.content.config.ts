import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  publicDir: false,
  build: {
    outDir: path.resolve(__dirname, 'dist/content'),
    emptyOutDir: false,
    sourcemap: false,
    lib: {
      entry: path.resolve(__dirname, 'src/content/iframe-bridge.ts'),
      name: 'TrueScaleIframeBridge',
      formats: ['iife'],
      fileName: () => 'iframe-bridge.js',
    },
  },
});
