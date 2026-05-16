import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('QA foundation CI workflow', () => {
  it('runs when QA harness, docs, config, or Playwright guard inputs change', () => {
    const workflow = readFileSync('.github/workflows/qa-foundation.yml', 'utf8');

    for (const watchedPath of [
      "'config/qa/**'",
      "'docs/qa/**'",
      "'playwright.config.ts'",
      "'playwright.app.config.ts'",
      "'playwright.reserve.config.ts'",
      "'scripts/check-luma-compliance.mjs'",
      "'scripts/qa/**'",
      "'tests/qa/**'",
    ]) {
      expect(workflow).toContain(watchedPath);
    }
  });
});
