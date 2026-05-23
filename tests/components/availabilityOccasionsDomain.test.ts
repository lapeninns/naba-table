import { describe, expect, it } from 'vitest';

import {
  addAvailabilityRuleDraft,
  addSpecificDateToAvailabilityRuleDraft,
  removeAvailabilityRuleDraft,
  removeSpecificDateFromAvailabilityRuleDraft,
  replaceAvailabilityRuleDraftKind,
  toggleAvailabilityRuleDraftMonth,
  updateAvailabilityRuleDraft,
} from '@/components/features/restaurant-settings/availabilityOccasionsDomain';
import { createRuleDraft } from '@/components/features/restaurant-settings/availabilityOccasionsModel';

describe('availabilityOccasionsDomain rule draft helpers', () => {
  it('adds, updates, and replaces rule draft kinds without mutating existing drafts', () => {
    const base = { ...createRuleDraft('time_window'), id: 'rule-1', start: '12:00' };

    const added = addAvailabilityRuleDraft([base]);
    expect(added).toHaveLength(2);
    expect(added[0]).toBe(base);
    expect(added[1].kind).toBe('anytime');

    const updated = updateAvailabilityRuleDraft([base], 'rule-1', { end: '14:00' });
    expect(updated[0]).toEqual({ ...base, end: '14:00' });
    expect(base.end).toBe('');

    const replaced = replaceAvailabilityRuleDraftKind([base], 'rule-1', 'month_only');
    expect(replaced[0]).toMatchObject({ id: 'rule-1', kind: 'month_only', months: [] });
    expect(replaced[0].start).toBe('');
  });

  it('removes rules while preserving the required fallback rule', () => {
    const first = { ...createRuleDraft('anytime'), id: 'rule-1' };
    const second = { ...createRuleDraft('month_only'), id: 'rule-2' };

    expect(removeAvailabilityRuleDraft([first, second], 'rule-1')).toEqual([second]);

    const fallback = removeAvailabilityRuleDraft([first], 'rule-1');
    expect(fallback).toHaveLength(1);
    expect(fallback[0].kind).toBe('anytime');
  });

  it('adds and removes specific dates with sorting, de-duplication, and pending-date reset', () => {
    const draft = {
      ...createRuleDraft('specific_dates'),
      id: 'rule-1',
      specificDates: ['2026-05-20'],
      pendingDate: '2026-05-18',
    };

    const added = addSpecificDateToAvailabilityRuleDraft([draft], 'rule-1');
    expect(added[0].specificDates).toEqual(['2026-05-18', '2026-05-20']);
    expect(added[0].pendingDate).toBe('');

    const duplicate = addSpecificDateToAvailabilityRuleDraft(
      [{ ...draft, pendingDate: '2026-05-20' }],
      'rule-1',
    );
    expect(duplicate[0].specificDates).toEqual(['2026-05-20']);

    const removed = removeSpecificDateFromAvailabilityRuleDraft(added, 'rule-1', '2026-05-18');
    expect(removed[0].specificDates).toEqual(['2026-05-20']);
  });

  it('toggles month selections in sorted order', () => {
    const draft = { ...createRuleDraft('month_only'), id: 'rule-1', months: [5] };

    const added = toggleAvailabilityRuleDraftMonth([draft], 'rule-1', 3);
    expect(added[0].months).toEqual([3, 5]);

    const removed = toggleAvailabilityRuleDraftMonth(added, 'rule-1', 5);
    expect(removed[0].months).toEqual([3]);
  });
});
