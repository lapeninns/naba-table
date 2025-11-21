import { describe, expect, it } from 'vitest';

import { buildMonthPrefetchTargets, deriveMaskAvailability } from '../usePlanStepForm';

import type { CalendarMask } from '@reserve/features/reservations/wizard/services/schedule';

const toYearMonth = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

describe('deriveMaskAvailability', () => {
  it('marks closed dates from mask while respecting minimum date', () => {
    const mask: CalendarMask = {
      timezone: 'UTC',
      from: '2025-05-10',
      to: '2025-05-12',
      closedDaysOfWeek: [0], // Sunday
      closedDates: ['2025-05-12'],
    };
    const normalizedMinTimestamp = new Date(2025, 4, 10).getTime();

    const result = deriveMaskAvailability(mask, normalizedMinTimestamp);

    expect(result.get('2025-05-10')).toBeNull();
    expect(result.get('2025-05-11')).toBe('closed');
    expect(result.get('2025-05-12')).toBe('closed');
    expect(Array.from(result.keys())).toEqual(['2025-05-10', '2025-05-11', '2025-05-12']);
  });
});

describe('buildMonthPrefetchTargets', () => {
  it('includes current, previous (when above min), and next month', () => {
    const current = new Date(2025, 4, 15); // May 2025
    const normalizedMinTimestamp = new Date(2025, 3, 1).getTime(); // April 1, 2025

    const months = buildMonthPrefetchTargets(current, normalizedMinTimestamp);

    expect(months.map(toYearMonth)).toEqual(['2025-05', '2025-04', '2025-06']);
  });

  it('omits previous month when before minimum date', () => {
    const current = new Date(2025, 4, 15); // May 2025
    const normalizedMinTimestamp = new Date(2025, 4, 5).getTime(); // May 5, 2025

    const months = buildMonthPrefetchTargets(current, normalizedMinTimestamp);

    expect(months.map(toYearMonth)).toEqual(['2025-05', '2025-06']);
  });
});
