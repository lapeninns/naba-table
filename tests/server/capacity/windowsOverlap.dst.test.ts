import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import { __internal as tablesInternal } from '@/server/capacity/tables';

const { windowsOverlap } = tablesInternal;

describe('windowsOverlap DST behavior (half-open)', () => {
  it('does not consider touching intervals as overlap', () => {
    const a = { start: DateTime.fromISO('2025-01-10T10:00:00Z'), end: DateTime.fromISO('2025-01-10T11:00:00Z') };
    const b = { start: DateTime.fromISO('2025-01-10T11:00:00Z'), end: DateTime.fromISO('2025-01-10T12:00:00Z') };
    expect(windowsOverlap(a, b)).toBe(false);
  });

  it('handles spring-forward non-existent local times by coercing forward', () => {
    // America/New_York spring-forward 2025-03-09: 02:00 → 03:00
    const zone = 'America/New_York';
    const a = {
      start: DateTime.fromObject({ year: 2025, month: 3, day: 9, hour: 1, minute: 30 }, { zone }),
      end: DateTime.fromObject({ year: 2025, month: 3, day: 9, hour: 3, minute: 0 }, { zone }),
    };
    const b = {
      // Start during the missing hour; internal coercion should push this to 03:00 local
      start: DateTime.fromObject({ year: 2025, month: 3, day: 9, hour: 2, minute: 15 }, { zone }),
      end: DateTime.fromObject({ year: 2025, month: 3, day: 9, hour: 2, minute: 45 }, { zone }),
    };
    expect(windowsOverlap(a, b)).toBe(false); // a ends at 03:00, b coerces to start at 03:00 → touching only
  });

  it('correctly detects overlap across DST periods when real overlap exists', () => {
    const zone = 'America/New_York';
    const a = {
      start: DateTime.fromObject({ year: 2025, month: 11, day: 2, hour: 0, minute: 30 }, { zone }),
      end: DateTime.fromObject({ year: 2025, month: 11, day: 2, hour: 2, minute: 30 }, { zone }),
    };
    const b = {
      start: DateTime.fromObject({ year: 2025, month: 11, day: 2, hour: 1, minute: 30 }, { zone }),
      end: DateTime.fromObject({ year: 2025, month: 11, day: 2, hour: 3, minute: 0 }, { zone }),
    };
    expect(windowsOverlap(a, b)).toBe(true);
  });
});

