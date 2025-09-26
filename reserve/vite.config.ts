import react from '@vitejs/plugin-react';
import path from 'node:path';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';

const analyze = process.env.ANALYZE === 'true';

export default defineConfig({
  root: __dirname,
  plugins: [react(), analyze && visualizer({ filename: 'dist/analyze.html', open: false })].filter(
    Boolean,
  ),
  resolve: {
    alias: {
      '@reserve': path.resolve(__dirname),
      '@': path.resolve(__dirname, '..'),
      '@app': path.resolve(__dirname, 'app'),
      '@features': path.resolve(__dirname, 'features'),
      '@entities': path.resolve(__dirname, 'entities'),
      '@shared': path.resolve(__dirname, 'shared'),
      '@pages': path.resolve(__dirname, 'pages'),
      '@tests': path.resolve(__dirname, 'tests'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, '../.reserve-dist'),
    emptyOutDir: true,
  },
  server: {
    port: 5174,
  },
});
