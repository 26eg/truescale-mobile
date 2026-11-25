import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  publicDir: false,
  plugins: [react(), tailwindcss()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: false,
    sourcemap: false,
    cssCodeSplit: false,
    lib: {
      entry: path.resolve(__dirname, 'src/inplace/main.tsx'),
      name: 'TrueScaleInPlace',
      formats: ['iife'],
      fileName: () => 'content/inplace-overlay.js',
    },
    rollupOptions: {
      output: {
        assetFileNames: (info) =>
          info.name?.endsWith('.css')
            ? 'assets/inplace-overlay.css'
            : 'assets/[name]-[hash][extname]',
      },
    },
  },
});
