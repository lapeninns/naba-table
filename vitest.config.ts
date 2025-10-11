import path from "node:path";
import { defineConfig } from "vitest/config";

// Use Object.assign to avoid TypeScript read-only property error
Object.assign(process.env, {
  NODE_ENV: "test",
  NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  BASE_URL: "http://localhost:3000",
  ENABLE_TEST_API: "true",
  USE_ASYNC_SIDE_EFFECTS: "false",
  QUEUE_PROVIDER: "inngest",
});

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/server/**/*.test.ts", "tests/emails/**/*.test.ts", "app/api/**/*.test.ts"],
    exclude: ["tests/e2e/**", "tests/component/**", "tests/visual/**"],
    setupFiles: ["./tests/vitest.setup.ts"],
  },
  resolve: {
    alias: {
      '@/': path.resolve(__dirname, './') + '/',
      '@reserve/': path.resolve(__dirname, './reserve/') + '/',
      '@app/': path.resolve(__dirname, './reserve/app/') + '/',
      '@features/': path.resolve(__dirname, './reserve/features/') + '/',
      '@entities/': path.resolve(__dirname, './reserve/entities/') + '/',
      '@shared/': path.resolve(__dirname, './reserve/shared/') + '/',
      '@pages/': path.resolve(__dirname, './reserve/pages/') + '/',
      '@tests/': path.resolve(__dirname, './reserve/tests/') + '/',
    },
  },
});
