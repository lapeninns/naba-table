import { describe, expect, it } from 'vitest';

import {
  findDuplicateTableNumberIssues,
  findOperatingHourIssues,
  findServicePeriodIssues,
  nextTableNumber,
} from '@/lib/onboarding/scheduleRules';

describe('findServicePeriodIssues @p1 @unit', () => {
  it('accepts non-overlapping periods on the same day', () => {
    expect(
      findServicePeriodIssues([
        {
          name: 'Lunch',
          dayOfWeek: 1,
          startTime: '12:00',
          endTime: '15:00',
          bookingOption: 'lunch',
        },
        {
          name: 'Dinner',
          dayOfWeek: 1,
          startTime: '15:00',
          endTime: '22:00',
          bookingOption: 'dinner',
        },
      ]),
    ).toEqual([]);
  });

  it('flags same-day overlaps on the later period with an actionable message', () => {
    const issues = findServicePeriodIssues([
      { name: 'Lunch', dayOfWeek: 2, startTime: '12:00', endTime: '15:00', bookingOption: 'lunch' },
      {
        name: 'Dinner',
        dayOfWeek: 2,
        startTime: '14:00',
        endTime: '22:00',
        bookingOption: 'dinner',
      },
    ]);
    expect(issues).toEqual([
      { path: [1, 'startTime'], message: 'Overlaps "Lunch" on the same day. Adjust the times.' },
    ]);
  });

  it('treats "all days" and a specific day as separate groups, as the server does', () => {
    expect(
      findServicePeriodIssues([
        {
          name: 'All',
          dayOfWeek: null,
          startTime: '12:00',
          endTime: '15:00',
          bookingOption: 'lunch',
        },
        { name: 'Mon', dayOfWeek: 1, startTime: '13:00', endTime: '16:00', bookingOption: 'lunch' },
      ]),
    ).toEqual([]);
  });

  it('flags end before start and malformed times', () => {
    const issues = findServicePeriodIssues([
      { name: 'Late', dayOfWeek: 1, startTime: '22:00', endTime: '21:00', bookingOption: 'dinner' },
      { name: 'Bad', dayOfWeek: 2, startTime: '7pm', endTime: '25:00', bookingOption: 'dinner' },
    ]);
    expect(issues).toEqual([
      { path: [0, 'endTime'], message: 'End time must be after the start time.' },
      { path: [1, 'startTime'], message: 'Enter a time like 17:00.' },
      { path: [1, 'endTime'], message: 'Enter a time like 17:00.' },
    ]);
  });

  it('allows overlaps for exempt booking options', () => {
    expect(
      findServicePeriodIssues(
        [
          { name: 'A', dayOfWeek: 1, startTime: '12:00', endTime: '15:00', bookingOption: 'lunch' },
          {
            name: 'B',
            dayOfWeek: 1,
            startTime: '13:00',
            endTime: '16:00',
            bookingOption: 'Drinks',
          },
        ],
        new Set(['drinks']),
      ),
    ).toEqual([]);
  });
});

describe('findOperatingHourIssues @p1 @unit', () => {
  it('accepts closed days without times and overnight hours', () => {
    expect(
      findOperatingHourIssues([
        { dayOfWeek: 0, opensAt: null, closesAt: null, isClosed: true },
        { dayOfWeek: 5, opensAt: '18:00', closesAt: '02:00', isClosed: false },
      ]),
    ).toEqual([]);
  });

  it('requires both times on open days and that they differ', () => {
    expect(
      findOperatingHourIssues([
        { dayOfWeek: 1, opensAt: '', closesAt: '22:00', isClosed: false },
        { dayOfWeek: 2, opensAt: '09:00', closesAt: '09:00:00', isClosed: false },
      ]),
    ).toEqual([
      { path: [0, 'opensAt'], message: 'Enter a time like 09:00.' },
      { path: [1, 'closesAt'], message: 'Closing time must differ from the opening time.' },
    ]);
  });

  it('flags a repeated day', () => {
    expect(
      findOperatingHourIssues([
        { dayOfWeek: 3, opensAt: null, closesAt: null, isClosed: true },
        { dayOfWeek: 3, opensAt: null, closesAt: null, isClosed: true },
      ]),
    ).toEqual([{ path: [1, 'dayOfWeek'], message: 'Each day can only appear once.' }]);
  });
});

describe('table numbers @p1 @unit', () => {
  it('flags duplicates case-sensitively after trimming, like the server', () => {
    expect(
      findDuplicateTableNumberIssues([
        { tableNumber: 'T2' },
        { tableNumber: 'T3' },
        { tableNumber: ' T3 ' },
        { tableNumber: 't3' },
      ]),
    ).toEqual([{ path: [2, 'tableNumber'], message: 'Table T3 is already in the list.' }]);
  });

  it('suggests the next unused number after a removal', () => {
    expect(nextTableNumber([{ tableNumber: 'T2' }, { tableNumber: 'T3' }])).toBe('T4');
    expect(nextTableNumber([])).toBe('T1');
    expect(nextTableNumber([{ tableNumber: 'Bar' }, { tableNumber: 'T9' }])).toBe('T10');
  });
});
