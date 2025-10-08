import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
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
