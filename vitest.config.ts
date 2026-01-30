import path from 'path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',

    // Global test setup
    globals: true,

    // Test file patterns
    include: [
      'tests/**/*.test.ts',
      'tests/**/*.test.tsx',
      'lib/**/*.test.ts',
      'server/**/*.test.ts',
    ],

    // Exclude patterns
    exclude: [
      'node_modules',
      '.next',
      'dist',
      'tasks',
    ],

    // Coverage configuration
    coverage: {
      enabled: false, // Enable with --coverage flag
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',

      // Coverage thresholds - enforced in CI
      thresholds: {
        lines: 0,
        functions: 0,
        branches: 0,
        statements: 0,
      },

      // Files to include in coverage
      include: [
        'lib/**/*.ts',
        'server/**/*.ts',
      ],

      // Files to exclude from coverage
      exclude: [
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/types/**',
        '**/index.ts',
        '**/*.d.ts',
      ],
    },

    // Test isolation
    isolate: true,
    pool: 'threads',

    // Timeouts
    testTimeout: 10000,
    hookTimeout: 10000,

    // Reporter configuration
    reporters: ['default'],

    // Retry flaky tests
    retry: process.env.CI ? 2 : 0,

    // Setup files
    setupFiles: ['./tests/setup.ts'],
  },

  // Path aliases (matching tsconfig)
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@/lib': path.resolve(__dirname, './lib'),
      '@/server': path.resolve(__dirname, './server'),
      '@/types': path.resolve(__dirname, './types'),
    },
  },
});
