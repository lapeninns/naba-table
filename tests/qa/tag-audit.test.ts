import { describe, expect, it } from 'vitest';

import {
  buildQaTagAuditSnapshot,
  compareQaTagAuditToBaseline,
  extractQaTestTitles,
} from '@/scripts/qa';

describe('QA tag audit', () => {
  it('extracts known sprint tags from Playwright and Vitest titles', () => {
    const entries = extractQaTestTitles(
      `
      test('@p0 @browser public booking loads', async () => {})
      it('@api @security rejects wrong tenant', async () => {})
      `,
      'tests/example.spec.ts',
    );

    expect(entries).toEqual([
      expect.objectContaining({
        tags: ['@p0', '@browser'],
        title: '@p0 @browser public booking loads',
      }),
      expect.objectContaining({
        tags: ['@api', '@security'],
        title: '@api @security rejects wrong tenant',
      }),
    ]);
  });

  it('fails when unknown tags or new untagged titles exceed the baseline', () => {
    const baseline = buildQaTagAuditSnapshot(
      extractQaTestTitles("it('existing untagged title', () => {})", 'tests/example.test.ts'),
      ['tests'],
    );
    const current = buildQaTagAuditSnapshot(
      extractQaTestTitles(
        [
          "it('existing untagged title', () => {})",
          "it('new untagged title', () => {})",
          `it('@p0 ${'@typo'} tagged with typo', () => {})`,
        ].join('\n'),
        'tests/example.test.ts',
      ),
      ['tests'],
    );

    const comparison = compareQaTagAuditToBaseline(current, baseline);

    expect(comparison.passed).toBe(false);
    expect(comparison.failures).toEqual(
      expect.arrayContaining([
        expect.stringContaining('unknown QA tag @typo'),
        expect.stringContaining('Untagged QA test titles increased from 1 to 2'),
        expect.stringContaining('above baseline 1'),
      ]),
    );
  });
});
