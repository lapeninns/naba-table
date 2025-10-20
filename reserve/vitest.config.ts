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
      '@/app': path.resolve(__dirname, '..', 'src/app'),
      '@/components/reserve': path.resolve(__dirname, '..', 'components/reserve'),
      '@/components/features': path.resolve(__dirname, '..', 'src/components/features'),
      '@/components': path.resolve(__dirname, '..', 'components'),
      '@/contexts': path.resolve(__dirname, '..', 'src/contexts'),
      '@/hooks': path.resolve(__dirname, '..', 'hooks'),
      '@/lib': path.resolve(__dirname, '..', 'lib'),
      '@/services': path.resolve(__dirname, '..', 'src/services'),
      '@/types': path.resolve(__dirname, '..', 'types'),
      '@/utils': path.resolve(__dirname, '..', 'src/utils'),
      '@/server': path.resolve(__dirname, '..', 'server'),
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
