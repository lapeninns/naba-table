import react from '@vitejs/plugin-react';
import path from 'node:path';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';

const analyze = process.env.ANALYZE === 'true';
const buildOutDir = process.env.RESERVE_BUILD_OUT_DIR
  ? path.resolve(__dirname, process.env.RESERVE_BUILD_OUT_DIR)
  : path.resolve(__dirname, '../dist/reserve');

const clientProcessEnv = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  APP_ENV: process.env.APP_ENV ?? 'development',
  LOG_LEVEL: process.env.LOG_LEVEL ?? '',
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV ?? process.env.APP_ENV ?? 'development',
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? '',
  NEXT_PUBLIC_APP_VERSION:
    process.env.NEXT_PUBLIC_APP_VERSION ?? process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? '',
  NEXT_PUBLIC_BOOKING_PENDING_GRACE_MINUTES:
    process.env.NEXT_PUBLIC_BOOKING_PENDING_GRACE_MINUTES ?? '',
  NEXT_PUBLIC_FORCE_PASSWORD_SIGNIN: process.env.NEXT_PUBLIC_FORCE_PASSWORD_SIGNIN ?? '',
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? '',
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY ?? '',
  NEXT_PUBLIC_RESERVE_API_BASE_URL: process.env.NEXT_PUBLIC_RESERVE_API_BASE_URL ?? '',
  NEXT_PUBLIC_RESERVE_API_TIMEOUT_MS: process.env.NEXT_PUBLIC_RESERVE_API_TIMEOUT_MS ?? '',
  NEXT_PUBLIC_RESERVE_ROUTER_BASE_PATH: process.env.NEXT_PUBLIC_RESERVE_ROUTER_BASE_PATH ?? '',
  NEXT_PUBLIC_RESERVE_V2: process.env.NEXT_PUBLIC_RESERVE_V2 ?? '',
  NEXT_PUBLIC_ROOT_DOMAIN: process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost',
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? '',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? '',
};

export default defineConfig({
  root: __dirname,
  plugins: [
    react(),
    analyze && visualizer({ filename: path.join(buildOutDir, 'analyze.html'), open: false }),
  ].filter(Boolean),
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
  define: {
    'process.env': JSON.stringify(clientProcessEnv),
  },
  build: {
    outDir: buildOutDir,
    emptyOutDir: true,
  },
  server: {
    port: 5174,
  },
});
