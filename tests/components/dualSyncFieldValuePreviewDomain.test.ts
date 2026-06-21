import { describe, expect, it } from 'vitest';

import { formatDualSyncFieldPreview } from '@/components/features/restaurant-settings/dual-sync/dualSyncFieldValuePreviewDomain';

describe('dualSyncFieldValuePreviewDomain', () => {
  it('formats preview values without leaking nullish or empty values into the UI', () => {
    expect(formatDualSyncFieldPreview(null)).toBe('—');
    expect(formatDualSyncFieldPreview(undefined)).toBe('—');
    expect(formatDualSyncFieldPreview('')).toBe('—');
    expect(formatDualSyncFieldPreview('Nabatable')).toBe('Nabatable');
    expect(formatDualSyncFieldPreview(12)).toBe('12');
    expect(formatDualSyncFieldPreview(false)).toBe('false');
    expect(formatDualSyncFieldPreview({ city: 'Cambridge' })).toBe('{"city":"Cambridge"}');
  });

  it('falls back to string conversion when object preview serialization fails', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(formatDualSyncFieldPreview(circular)).toBe('[object Object]');
  });
});
