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
    reporters: ['default', 'json'],
    outputFile: {
      json: './test-results/vitest-results.json',
    },
    include: [
      "tests/server/**/*.test.ts",
      "tests/server/**/*.test.tsx",
      "tests/emails/**/*.test.ts",
      "tests/ops/**/*.test.tsx",
      "tests/scripts/**/*.test.ts",
      "app/api/**/*.test.ts",
      "src/app/api/**/*.test.ts",
      "src/proxy.test.ts",
      "reserve/**/*.test.ts",
      "reserve/**/*.test.tsx",
    ],
    exclude: ["tests/e2e/**", "tests/component/**", "tests/visual/**"],
    setupFiles: ["./tests/vitest.setup.ts"],
    coverage: {
      provider: "v8",
      enabled: true,
      reporter: ["text", "json-summary", "html"],
      exclude: [
        "**/*.d.ts",
        "**/*.test.*",
        "**/*.spec.*",
        "**/__tests__/**",
        "tests/**",
        "reserve/tests/**",
        "playwright/**",
        ".next/**",
        "dist/**",
        "build/**",
        "coverage/**"
      ],
      thresholds: {
        lines: 20,
        statements: 20,
        functions: 15,
        branches: 10
      }
    },
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
      { find: '@/guest', replacement: path.resolve(__dirname, './src/guest') },
      { find: /^@\/hooks\/ops/, replacement: path.resolve(__dirname, './src/hooks/ops') },
      { find: '@/hooks/use-mobile', replacement: path.resolve(__dirname, './hooks/use-mobile') },
      { find: '@/hooks/use-toast', replacement: path.resolve(__dirname, './hooks/use-toast') },
      { find: '@/hooks/useOnlineStatus', replacement: path.resolve(__dirname, './hooks/useOnlineStatus') },
      { find: '@/hooks/useGuestPreferences', replacement: path.resolve(__dirname, './hooks/useGuestPreferences') },
      { find: '@/hooks/useSupabaseSession', replacement: path.resolve(__dirname, './hooks/useSupabaseSession') },
      { find: /^@\/hooks/, replacement: path.resolve(__dirname, './src/hooks') },
      { find: '@/services', replacement: path.resolve(__dirname, './src/services') },
      { find: '@/utils', replacement: path.resolve(__dirname, './src/utils') },
      { find: /^@\/components\/landing/, replacement: path.resolve(__dirname, './src/components/landing') },
      { find: /^@\/components\/ui/, replacement: path.resolve(__dirname, './components/ui') },
      { find: /^@\/components\/layouts/, replacement: path.resolve(__dirname, './src/components/layouts') },
      { find: /^@\/components\/guest/, replacement: path.resolve(__dirname, './src/components/guest') },
      { find: /^@\/components\/features/, replacement: path.resolve(__dirname, './src/components/features') },
      { find: /^@\/components\/providers/, replacement: path.resolve(__dirname, './src/components/providers') },
      { find: /^@\/components\/shared/, replacement: path.resolve(__dirname, './src/components/shared') },
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
