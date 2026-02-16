import { describe, expect, it } from 'vitest';

import { toIsoTime } from '@/components/features/dashboard/list/utils';

describe('toIsoTime', () => {
  it('returns offset-aware UTC ISO for UTC-zone values', () => {
    expect(toIsoTime('2026-03-14', '18:30', 'Europe/London')).toBe('2026-03-14T18:30:00.000Z');
  });

  it('converts local wall time to UTC ISO using restaurant timezone', () => {
    // July is BST (UTC+1) in London.
    expect(toIsoTime('2026-07-14', '18:30', 'Europe/London')).toBe('2026-07-14T17:30:00.000Z');
  });

  it('defaults missing time to midnight while preserving offset', () => {
    expect(toIsoTime('2026-02-16', null, 'UTC')).toBe('2026-02-16T00:00:00.000Z');
  });

  it('keeps fallback payloads offset-aware for malformed timezone input', () => {
    const iso = toIsoTime('2026-02-16', '09:15', 'Invalid/Zone');
    expect(iso.endsWith('Z')).toBe(true);
    expect(Number.isNaN(new Date(iso).getTime())).toBe(false);
  });
});
