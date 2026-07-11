import { describe, expect, it } from 'vitest';

import {
  clampToServiceWindow,
  DEFAULT_STATUS_FILTERS,
  formatTime,
  minutesSinceStart,
  parseHHMM,
  SERVICE_OPTIONS,
  SLOT_WIDTH_PX,
  STATUS_META,
  STATUS_OPTIONS,
  TIME_SLOTS,
  timeToPositionPx,
  toHHMM,
} from '@/components/features/tables/timeline/tableTimelineDomain';

// toHHMM/formatTime render in the host's local timezone, so build inputs from
// local Date components — the expected output is then identical in any TZ.
function localIso(hours: number, minutes: number): string {
  return new Date(2026, 5, 10, hours, minutes, 0, 0).toISOString();
}

describe('tableTimelineDomain', () => {
  it('@contract exposes twelve half-hour slots across the 17:00-22:30 service window', () => {
    expect(TIME_SLOTS).toHaveLength(12);
    expect(TIME_SLOTS[0]).toBe('17:00');
    expect(TIME_SLOTS[1]).toBe('17:30');
    expect(TIME_SLOTS[TIME_SLOTS.length - 1]).toBe('22:30');
  });

  it('@contract parses HH:MM strings into hour and minute parts', () => {
    expect(parseHHMM('18:30')).toEqual({ hours: 18, minutes: 30 });
    expect(parseHHMM('07:05')).toEqual({ hours: 7, minutes: 5 });
  });

  it('@contract measures minutes and pixels from the 17:00 service start', () => {
    expect(minutesSinceStart('17:00')).toBe(0);
    expect(minutesSinceStart('18:30')).toBe(90);

    expect(timeToPositionPx('17:00')).toBe(0);
    expect(timeToPositionPx('17:30')).toBe(SLOT_WIDTH_PX);
    expect(timeToPositionPx('18:00')).toBe(2 * SLOT_WIDTH_PX);
  });

  it('@contract clamps positions into the service window', () => {
    const start = '17:00';
    const end = '22:30';

    // Before the window clamps to the window start.
    expect(clampToServiceWindow(timeToPositionPx('16:00'), start, end)).toBe(
      timeToPositionPx(start),
    );
    // After the window clamps to the window end.
    expect(clampToServiceWindow(timeToPositionPx('23:30'), start, end)).toBe(
      timeToPositionPx(end),
    );
    // Inside the window is unchanged.
    expect(clampToServiceWindow(timeToPositionPx('19:00'), start, end)).toBe(
      timeToPositionPx('19:00'),
    );
  });

  it('@contract formats timestamps as zero-padded local HH:MM', () => {
    expect(toHHMM(localIso(18, 5))).toBe('18:05');
    expect(toHHMM(localIso(9, 0))).toBe('09:00');
  });

  it('@contract formats timestamps as locale time strings with hour and minutes', () => {
    // Locale-dependent AM/PM markers are not asserted, only the clock value.
    expect(formatTime(localIso(18, 5))).toMatch(/6:05|18:05/);
  });

  it('@contract covers every segment state in the status options and meta map', () => {
    const states = ['reserved', 'hold', 'available', 'out_of_service'];

    expect(STATUS_OPTIONS.map((option) => option.value)).toEqual(states);
    expect(DEFAULT_STATUS_FILTERS).toEqual(states);
    expect(Object.keys(STATUS_META).sort()).toEqual([...states].sort());

    for (const option of STATUS_OPTIONS) {
      expect(option.label.length).toBeGreaterThan(0);
      expect(STATUS_META[option.value].label).toBe(option.label);
    }
  });

  it('@contract offers all, lunch, and dinner service filters', () => {
    expect(SERVICE_OPTIONS.map((option) => option.value)).toEqual(['all', 'lunch', 'dinner']);
  });
});
