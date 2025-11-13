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
});

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    include: [
      "tests/server/**/*.test.ts",
      "tests/server/**/*.test.tsx",
      "tests/emails/**/*.test.ts",
      "tests/ops/**/*.test.tsx",
      "tests/scripts/**/*.test.ts",
      "app/api/**/*.test.ts",
      "src/app/api/**/*.test.ts",
    ],
    exclude: ["tests/e2e/**", "tests/component/**", "tests/visual/**"],
    setupFiles: ["./tests/vitest.setup.ts"],
    benchmark: {
      include: ["tests/benchmarks/**/*.bench.ts"],
    },
  },
  resolve: {
    alias: [
      { find: '@/app', replacement: path.resolve(__dirname, './src/app') },
      { find: '@/server', replacement: path.resolve(__dirname, './server') },
      { find: '@/lib', replacement: path.resolve(__dirname, './lib') },
      { find: '@/contexts', replacement: path.resolve(__dirname, './src/contexts') },
      { find: /^@\/hooks\/ops/, replacement: path.resolve(__dirname, './src/hooks/ops') },
      { find: /^@\/hooks/, replacement: path.resolve(__dirname, './hooks') },
      { find: '@/services', replacement: path.resolve(__dirname, './src/services') },
      { find: '@/utils', replacement: path.resolve(__dirname, './src/utils') },
      { find: /^@\/components\/ui/, replacement: path.resolve(__dirname, './components/ui') },
      { find: /^@\/components\/features/, replacement: path.resolve(__dirname, './src/components/features') },
      { find: '@/components', replacement: path.resolve(__dirname, './components') },
      { find: '@/', replacement: path.resolve(__dirname, './') + '/' },
      { find: '@reserve/', replacement: path.resolve(__dirname, './reserve/') + '/' },
      { find: '@app/', replacement: path.resolve(__dirname, './reserve/app/') + '/' },
      { find: '@features/', replacement: path.resolve(__dirname, './reserve/features/') + '/' },
      { find: '@entities/', replacement: path.resolve(__dirname, './reserve/entities/') + '/' },
      { find: '@shared/', replacement: path.resolve(__dirname, './reserve/shared/') + '/' },
      { find: '@pages/', replacement: path.resolve(__dirname, './reserve/pages/') + '/' },
      { find: '@tests/', replacement: path.resolve(__dirname, './reserve/tests/') + '/' },
    ],
  },
});
