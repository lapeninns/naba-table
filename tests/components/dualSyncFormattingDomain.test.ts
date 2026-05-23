import { describe, expect, it } from 'vitest';

import { formatDualSyncTimestamp } from '@/components/features/restaurant-settings/dual-sync/dualSyncFormattingDomain';

describe('dualSyncFormattingDomain', () => {
  it('returns the configured empty fallback for missing timestamps', () => {
    expect(formatDualSyncTimestamp(null, { emptyFallback: '-' })).toBe('-');
    expect(formatDualSyncTimestamp(undefined, { emptyFallback: '—' })).toBe('—');
  });

  it('preserves invalid timestamp source values for diagnostics', () => {
    expect(formatDualSyncTimestamp('not-a-date', { emptyFallback: '-' })).toBe('not-a-date');
  });

  it('formats valid timestamps for the current locale', () => {
    expect(formatDualSyncTimestamp('2026-05-09T12:00:00.000Z', { emptyFallback: '-' })).toContain(
      '2026',
    );
  });
});
