import { describe, expect, it } from 'vitest';

import {
  googleDayToNumber,
  normalizeGoogleDate,
  normalizeGoogleTime,
  normalizeMoreHoursTypes,
} from '@/server/google-business-profile/businessInfoScheduleNormalization';

describe('google business profile business info schedule normalization', () => {
  it('normalizes more-hours type metadata while filtering empty entries', () => {
    expect(
      normalizeMoreHoursTypes([
        {
          hoursTypeId: ' DRIVE_THROUGH ',
          displayName: 'Drive through',
          localizedDisplayName: ' Drive-through ',
        },
        { hoursTypeId: '', displayName: '', localizedDisplayName: '' },
        { displayName: 'Label only' },
      ]),
    ).toEqual([
      {
        hoursTypeId: 'DRIVE_THROUGH',
        displayName: 'Drive through',
        localizedDisplayName: 'Drive-through',
      },
      {
        hoursTypeId: null,
        displayName: 'Label only',
        localizedDisplayName: null,
      },
    ]);
  });

  it('maps Google weekday strings to existing numeric values', () => {
    expect(googleDayToNumber(' sunday ')).toBe(0);
    expect(googleDayToNumber('FRIDAY')).toBe(5);
    expect(googleDayToNumber('weekday')).toBeNull();
    expect(googleDayToNumber(undefined)).toBeNull();
  });

  it('normalizes Google time strings and object payloads', () => {
    expect(normalizeGoogleTime('9:05:00')).toBe('09:05');
    expect(normalizeGoogleTime('24:00')).toBe('24:00');
    expect(normalizeGoogleTime({ hours: 9 })).toBe('09:00');
    expect(normalizeGoogleTime({ hours: 9, minutes: 5 })).toBe('09:05');
    expect(normalizeGoogleTime({ hours: 25, minutes: 0 })).toBeNull();
    expect(normalizeGoogleTime('9:5')).toBeNull();
  });

  it('normalizes Google date payloads', () => {
    expect(normalizeGoogleDate({ year: 2026, month: 5, day: 7 })).toBe('2026-05-07');
    expect(normalizeGoogleDate({ year: 0, month: 5, day: 7 })).toBeNull();
    expect(normalizeGoogleDate({ year: 2026, month: undefined, day: 7 })).toBeNull();
    expect(normalizeGoogleDate(null)).toBeNull();
  });
});
