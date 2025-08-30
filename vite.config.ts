import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as path from 'path';

// Vite builds the renderer into dist/renderer
export default defineConfig(({ command }) => ({
  root: path.resolve(__dirname, 'src/renderer'),
  plugins: [react()],
  // Use relative base in production so Electron can load file:// assets
  base: command === 'build' ? './' : '/',
  build: {
    outDir: path.resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
}));
