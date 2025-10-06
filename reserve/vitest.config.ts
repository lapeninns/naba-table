import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: __dirname,
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup-tests.ts'],
    exclude: ['tests/e2e/**'],
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      RESEND_API_KEY: 'test-resend-key',
      RESEND_FROM: 'notifications@example.com',
      BASE_URL: 'http://localhost:3000',
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
    },
  },
  resolve: {
    alias: {
      '@/': path.resolve(__dirname, '..') + '/',
      '@reserve': path.resolve(__dirname),
      '@app': path.resolve(__dirname, 'app'),
      '@features': path.resolve(__dirname, 'features'),
      '@entities': path.resolve(__dirname, 'entities'),
      '@shared': path.resolve(__dirname, 'shared'),
      '@pages': path.resolve(__dirname, 'pages'),
      '@tests': path.resolve(__dirname, 'tests'),
    },
  },
});
