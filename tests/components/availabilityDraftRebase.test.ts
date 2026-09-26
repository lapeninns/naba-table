import { describe, expect, it } from 'vitest';

import { rebaseAvailabilityDraft } from '@/components/features/restaurant-settings/availability/availabilityDraftRebase';

import type { AvailabilityPageDraft } from '@/components/features/restaurant-settings/availability/availabilityPageDraft';
import type { DayServiceConfig } from '@/components/features/restaurant-settings/servicePeriodsMapper';
import type { OverrideRow, WeeklyRow } from '@/components/features/restaurant-settings/types';

function weekly(dayOfWeek: number, opensAt = '12:00', closesAt = '22:00'): WeeklyRow {
  return {
    dayOfWeek,
    opensAt,
    closesAt,
    isClosed: false,
    notes: '',
    reservationIntervalMinutes: '',
    reservationSlotTimes: '',
  };
}

function day(dayOfWeek: number, lunchStart = '12:00'): DayServiceConfig {
  return {
    dayOfWeek,
    label: `Day ${dayOfWeek}`,
    opensAt: '12:00',
    closesAt: '22:00',
    isClosed: false,
    lunch: {
      id: `l${dayOfWeek}`,
      name: 'Lunch',
      startTime: lunchStart,
      endTime: '15:00',
      enabled: true,
    },
    dinner: {
      id: `d${dayOfWeek}`,
      name: 'Dinner',
      startTime: '17:00',
      endTime: '22:00',
      enabled: true,
    },
  };
}

function override(id: string, effectiveDate: string, closesAt = '18:00'): OverrideRow {
  return {
    id,
    effectiveDate,
    opensAt: '12:00',
    closesAt,
    isClosed: false,
    notes: '',
    reservationIntervalMinutes: '',
    reservationSlotTimes: '',
  };
}

function baseDraft(): AvailabilityPageDraft {
  return {
    weeklyRows: [weekly(1), weekly(2)],
    overrideRows: [override('o1', '2026-12-24')],
    dayConfigs: [day(1), day(2)],
    customRows: [],
    occasions: [],
    turnBands: { dinner: [{ maxPartySize: 4, durationMinutes: 90 }] },
    rules: {
      reservationIntervalMinutes: '15',
      reservationLastSeatingBufferMinutes: '15',
      reservationDefaultDurationMinutes: '90',
      reservationLifecycleGraceMinutes: '15',
      bookingPolicy: '',
    },
  };
}

describe('rebaseAvailabilityDraft', () => {
  it('takes newer saved values staff did not touch and keeps staff edits elsewhere', () => {
    const base = baseDraft();
    const mine = baseDraft();
    mine.rules.reservationIntervalMinutes = '30';
    mine.weeklyRows[0] = weekly(1, '11:00');
    const theirs = baseDraft();
    // A Google import of Tuesday's hours and a new special date.
    theirs.weeklyRows[1] = weekly(2, '12:00', '23:00');
    theirs.overrideRows.push(override('o2', '2026-12-31'));
    theirs.dayConfigs[1] = day(2, '11:30');

    const { draft, conflicts } = rebaseAvailabilityDraft({ base, mine, theirs });

    expect(conflicts).toEqual([]);
    expect(draft.rules.reservationIntervalMinutes).toBe('30');
    expect(draft.weeklyRows).toEqual([weekly(1, '11:00'), weekly(2, '12:00', '23:00')]);
    expect(draft.overrideRows.map((row) => row.id)).toEqual(['o1', 'o2']);
    expect(draft.dayConfigs[1]?.lunch.startTime).toBe('11:30');
  });

  it('keeps staff edits where both sides changed the same value and names those sections', () => {
    const base = baseDraft();
    const mine = baseDraft();
    mine.weeklyRows[0] = weekly(1, '12:00', '21:00');
    mine.dayConfigs[0] = day(1, '12:30');
    mine.rules.reservationDefaultDurationMinutes = '120';
    const theirs = baseDraft();
    theirs.weeklyRows[0] = weekly(1, '12:00', '23:00');
    theirs.dayConfigs[0] = day(1, '11:00');
    theirs.rules.reservationDefaultDurationMinutes = '105';
    theirs.rules.bookingPolicy = 'Call for 9+';

    const { draft, conflicts } = rebaseAvailabilityDraft({ base, mine, theirs });

    expect(conflicts).toEqual(['types', 'hours', 'meals']);
    expect(draft.weeklyRows[0]?.closesAt).toBe('21:00');
    expect(draft.dayConfigs[0]?.lunch.startTime).toBe('12:30');
    expect(draft.rules.reservationDefaultDurationMinutes).toBe('120');
    // A rule only the server changed is still taken.
    expect(draft.rules.bookingPolicy).toBe('Call for 9+');
  });

  it('keeps a special date staff removed unless the server changed it, and drops ones the server removed', () => {
    const base = baseDraft();
    base.overrideRows.push(override('o2', '2026-12-31'));
    const mine = { ...baseDraft(), overrideRows: [override('o2', '2026-12-31')] };
    const theirs = { ...baseDraft(), overrideRows: [override('o1', '2026-12-24')] };

    const { draft, conflicts } = rebaseAvailabilityDraft({ base, mine, theirs });

    expect(draft.overrideRows).toEqual([]);
    expect(conflicts).toEqual([]);
  });
});
