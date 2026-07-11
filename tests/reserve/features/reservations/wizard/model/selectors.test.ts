import { describe, expect, it } from 'vitest';

import { getInitialDetails } from '@features/reservations/wizard/model/reducer';
import { createSelectionSummary } from '@features/reservations/wizard/model/selectors';

describe('createSelectionSummary', () => {
  it('summarizes a complete selection @contract @smoke', () => {
    const summary = createSelectionSummary(
      getInitialDetails({
        date: '2026-04-14',
        time: '19:00',
        party: 4,
        bookingType: 'dinner',
      }),
    );

    expect(summary.primary).toBe('Dinner');
    expect(summary.details).toEqual(['4 guests', '19:00', 'Apr 14 2026']);
    expect(summary.srLabel).toBe('Dinner. 4 guests, 19:00, Apr 14 2026');
  });

  it('uses singular guest wording for a party of one @contract', () => {
    const summary = createSelectionSummary(
      getInitialDetails({ date: '2026-04-14', time: '12:30', party: 1, bookingType: 'lunch' }),
    );

    expect(summary.primary).toBe('Lunch');
    expect(summary.details[0]).toBe('1 guest');
  });

  it('falls back to placeholders when date or time are unselected @contract', () => {
    const summary = createSelectionSummary(
      getInitialDetails({ date: '', time: '', party: 2, bookingType: 'dinner' }),
    );

    expect(summary.details).toEqual(['2 guests', 'Time not selected', 'Date not selected']);
    expect(summary.srLabel).toContain('Date not selected');
  });
});
