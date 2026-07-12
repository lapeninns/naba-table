import { describe, expect, it } from 'vitest';

import { getInitialDetails } from '@features/reservations/wizard/model/reducer';
import {
  createConfirmationSummary,
  createSelectionSummary,
} from '@features/reservations/wizard/model/selectors';

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

  it('produces labeled booking facts in reading order, omitting empty notes @contract', () => {
    const summary = createSelectionSummary(
      getInitialDetails({ date: '2026-04-14', time: '19:00', party: 4, bookingType: 'dinner' }),
    );

    expect(summary.facts).toEqual([
      { label: 'Date', value: 'Apr 14 2026' },
      { label: 'Time', value: '19:00' },
      { label: 'Party', value: '4 guests' },
      { label: 'Service', value: 'Dinner' },
    ]);
  });

  it('includes trimmed notes as a fact when present @contract', () => {
    const summary = createSelectionSummary(
      getInitialDetails({
        date: '2026-04-14',
        time: '19:00',
        party: 2,
        bookingType: 'dinner',
        notes: '  Window seat please  ',
      }),
    );

    expect(summary.facts).toContainEqual({ label: 'Notes', value: 'Window seat please' });
  });
});

describe('createConfirmationSummary', () => {
  it('surfaces the booking reference and when/party as facts @contract', () => {
    const summary = createConfirmationSummary(
      'Q8H42',
      getInitialDetails({ date: '2026-04-14', time: '19:00', party: 4, bookingType: 'dinner' }),
    );

    expect(summary.primary).toBe('Booking confirmed');
    expect(summary.facts).toEqual([
      { label: 'Reference', value: 'Q8H42' },
      { label: 'When', value: 'Apr 14 2026 · 19:00' },
      { label: 'Party', value: '4 guests' },
    ]);
  });
});
