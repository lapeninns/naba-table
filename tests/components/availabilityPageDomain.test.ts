import { describe, expect, it } from 'vitest';

import { buildAvailabilityAttention } from '@/components/features/restaurant-settings/availability/availabilityAttention';
import {
  buildAvailabilityPageDraft,
  copyWeekday,
  describeAvailabilityChanges,
  getDirtyAvailabilityGroups,
  isWeekdayEdited,
  patchMeal,
  patchWeekday,
  undoAvailabilityGroup,
  undoWeekday,
  withRequiredBookingTypes,
  type AvailabilityPageDraft,
} from '@/components/features/restaurant-settings/availability/availabilityPageDraft';
import {
  orderAvailabilityErrorKeys,
  validateAvailabilityDraft,
} from '@/components/features/restaurant-settings/availability/availabilityPageValidation';
import { formatTimeRanges } from '@/components/features/restaurant-settings/availability/availabilityPreviewModel';
import {
  hasNarrowedWeeklyHours,
  planAvailabilitySave,
} from '@/components/features/restaurant-settings/availability/availabilitySavePlan';
import { availabilityErrorGroup } from '@/components/features/restaurant-settings/availability/useAvailabilityPageController';

import type { OpsOccasion } from '@/services/ops/occasions';
import type { RestaurantProfile } from '@/services/ops/restaurants';

const occasion = (key: string, isActive = true): OpsOccasion => ({
  key,
  label: key[0]!.toUpperCase() + key.slice(1),
  shortLabel: key,
  description: null,
  availability: [{ kind: 'anytime' }],
  defaultDurationMinutes: 90,
  displayOrder: key === 'lunch' ? 10 : 20,
  isActive,
  isBuiltin: true,
});

function buildSaved(
  occasions: OpsOccasion[] = [occasion('lunch'), occasion('dinner')],
): AvailabilityPageDraft {
  return buildAvailabilityPageDraft({
    operatingHours: {
      weekly: Array.from({ length: 7 }, (_, dayOfWeek) => ({
        dayOfWeek,
        opensAt: '12:00',
        closesAt: '22:00',
        isClosed: dayOfWeek === 1,
        notes: null,
        reservationIntervalMinutes: null,
        reservationSlotTimes: null,
      })),
      overrides: [
        {
          id: 'christmas',
          effectiveDate: '2026-12-25',
          opensAt: null,
          closesAt: null,
          isClosed: true,
          notes: 'Christmas Day',
        },
      ],
    },
    servicePeriods: [2, 3, 4, 5, 6, 0].flatMap((dayOfWeek) => [
      {
        id: `l${dayOfWeek}`,
        name: 'Lunch',
        dayOfWeek,
        startTime: '12:00',
        endTime: '14:30',
        bookingOption: 'lunch',
      },
      {
        id: `d${dayOfWeek}`,
        name: 'Dinner',
        dayOfWeek,
        startTime: '17:30',
        endTime: '21:30',
        bookingOption: 'dinner',
      },
    ]),
    occasions,
    turnBands: { restaurantId: 'r', bands: {}, defaults: {} },
    profile: {
      reservationIntervalMinutes: 15,
      reservationDefaultDurationMinutes: 90,
      reservationLastSeatingBufferMinutes: 60,
      reservationLifecycleGraceMinutes: 15,
      bookingPolicy: null,
    } as RestaurantProfile,
  });
}

describe('availability page draft', () => {
  it('finds no changes on a fresh draft and one group per kind of edit', () => {
    const saved = buildSaved();
    expect(getDirtyAvailabilityGroups(saved, saved)).toEqual([]);

    const edited = patchMeal(patchWeekday(saved, 2, { closesAt: '21:00' }), 2, 'dinner', {
      endTime: '21:00',
    });
    expect(getDirtyAvailabilityGroups(saved, edited)).toEqual(['hours', 'meals']);
    expect(isWeekdayEdited(saved, edited, 2)).toBe(true);
    expect(isWeekdayEdited(saved, edited, 3)).toBe(false);

    const rules = { ...saved, rules: { ...saved.rules, bookingPolicy: 'Call for 9+' } };
    expect(getDirtyAvailabilityGroups(saved, rules)).toEqual(['rules']);
  });

  it('treats a closed day’s meals as off, matching what is saved', () => {
    const saved = buildSaved();
    const closed = patchWeekday(saved, 2, { isClosed: true });

    expect(getDirtyAvailabilityGroups(saved, closed)).toEqual(['hours', 'meals']);
    // The draft still remembers Tuesday's meal times, so reopening restores them.
    const reopened = patchWeekday(closed, 2, { isClosed: false });
    expect(getDirtyAvailabilityGroups(saved, reopened)).toEqual([]);
  });

  it('copies hours and meal times but not notes or slot options', () => {
    const saved = buildSaved();
    const source = patchWeekday(saved, 2, {
      opensAt: '11:00',
      notes: 'Tuesday note',
      reservationIntervalMinutes: '20',
    });
    const copied = copyWeekday(source, 2, [3, 1]);
    const wednesday = copied.weeklyRows.find((row) => row.dayOfWeek === 3)!;
    const monday = copied.weeklyRows.find((row) => row.dayOfWeek === 1)!;

    expect(wednesday.opensAt).toBe('11:00');
    expect(wednesday.notes).toBe('');
    expect(wednesday.reservationIntervalMinutes).toBe('');
    expect(monday.isClosed).toBe(false);
    expect(copied.dayConfigs.find((day) => day.dayOfWeek === 1)!.lunch).toMatchObject({
      enabled: true,
      startTime: '12:00',
      endTime: '14:30',
    });
  });

  it('undoes one weekday or one save group', () => {
    const saved = buildSaved();
    const edited = patchWeekday(patchWeekday(saved, 2, { closesAt: '21:00' }), 3, {
      closesAt: '23:00',
    });

    expect(isWeekdayEdited(saved, undoWeekday(saved, edited, 2), 2)).toBe(false);
    expect(isWeekdayEdited(saved, undoWeekday(saved, edited, 2), 3)).toBe(true);
    expect(
      getDirtyAvailabilityGroups(saved, undoAvailabilityGroup(saved, edited, 'hours')),
    ).toEqual([]);
  });

  it('describes changes as was → now lines grouped by section', () => {
    const saved = buildSaved();
    const edited = {
      ...patchWeekday(saved, 2, { closesAt: '21:00' }),
      overrideRows: [
        ...saved.overrideRows,
        {
          id: 'eve',
          effectiveDate: '2026-12-24',
          opensAt: '12:00',
          closesAt: '16:00',
          isClosed: false,
          notes: 'Christmas Eve',
          reservationIntervalMinutes: '',
          reservationSlotTimes: '',
        },
      ],
    };
    const groups = describeAvailabilityChanges(saved, edited);
    const hours = groups.find((group) => group.id === 'hours')!.changes;

    expect(hours).toContainEqual({
      label: 'Tuesday opening hours',
      was: '12:00–22:00',
      now: '12:00–21:00',
    });
    expect(hours).toContainEqual({
      label: 'Special date added: Thu 24 Dec 2026',
      now: '12:00–16:00 · Christmas Eve',
    });
  });

  it('groups the default table time with Booking types and table times, not Booking rules', () => {
    const saved = buildSaved();
    const withDefault = {
      ...saved,
      rules: { ...saved.rules, reservationDefaultDurationMinutes: '105' },
    };

    expect(getDirtyAvailabilityGroups(saved, withDefault)).toEqual(['types']);
    expect(planAvailabilitySave(saved, withDefault)).toEqual(['types']);
    const groups = describeAvailabilityChanges(saved, withDefault);
    expect(groups.find((group) => group.id === 'types')!.changes).toEqual([
      { label: 'Default table time', was: '90 min', now: '105 min' },
    ]);
    expect(groups.find((group) => group.id === 'rules')!.changes).toEqual([]);

    // Undoing each group touches only what that section shows.
    const both = {
      ...withDefault,
      rules: { ...withDefault.rules, bookingPolicy: 'Call for 9+' },
    };
    expect(getDirtyAvailabilityGroups(saved, both)).toEqual(['types', 'rules']);
    const rulesUndone = undoAvailabilityGroup(saved, both, 'rules');
    expect(rulesUndone.rules).toMatchObject({
      bookingPolicy: saved.rules.bookingPolicy,
      reservationDefaultDurationMinutes: '105',
    });
    const typesUndone = undoAvailabilityGroup(saved, both, 'types');
    expect(typesUndone.rules).toMatchObject({
      bookingPolicy: 'Call for 9+',
      reservationDefaultDurationMinutes: saved.rules.reservationDefaultDurationMinutes,
    });
  });

  it('orders a default table time issue with the booking types, after the booking rules', () => {
    const saved = buildSaved();
    const invalid = {
      ...saved,
      rules: {
        ...saved.rules,
        reservationDefaultDurationMinutes: '5',
        reservationLastSeatingBufferMinutes: '1',
      },
    };
    const errors = validateAvailabilityDraft(invalid, getDirtyAvailabilityGroups(saved, invalid));

    expect(Object.keys(errors)).toEqual(expect.arrayContaining(['r-duration', 'r-buffer']));
    const ordered = orderAvailabilityErrorKeys(errors);
    expect(ordered.indexOf('r-buffer')).toBeLessThan(ordered.indexOf('r-duration'));
  });

  it('adds Lunch and Dinner to the draft only when missing', () => {
    expect(withRequiredBookingTypes([]).map((item) => item.key)).toEqual(['lunch', 'dinner']);
    expect(withRequiredBookingTypes([occasion('lunch')]).map((item) => item.key)).toEqual([
      'dinner',
      'lunch',
    ]);
  });
});

describe('availability save plan', () => {
  it('writes booking types first and booking rules last', () => {
    const saved = buildSaved();
    const draft = {
      ...patchWeekday(saved, 2, { closesAt: '23:00' }),
      occasions: [...saved.occasions, occasion('brunch')],
      rules: { ...saved.rules, reservationIntervalMinutes: '30' },
    };
    expect(planAvailabilitySave(saved, draft)).toEqual(['types', 'hours', 'rules']);
  });

  it('writes meal times before hours when a day closes earlier or closes altogether', () => {
    const saved = buildSaved();
    const narrowed = patchMeal(patchWeekday(saved, 2, { closesAt: '21:00' }), 2, 'dinner', {
      endTime: '21:00',
    });
    expect(hasNarrowedWeeklyHours(saved, narrowed)).toBe(true);
    expect(planAvailabilitySave(saved, narrowed)).toEqual(['meals', 'hours']);

    const closed = patchWeekday(saved, 2, { isClosed: true });
    expect(planAvailabilitySave(saved, closed)).toEqual(['meals', 'hours']);
  });

  it('writes hours before meal times when hours widen', () => {
    const saved = buildSaved();
    const widened = patchMeal(patchWeekday(saved, 2, { closesAt: '23:00' }), 2, 'dinner', {
      endTime: '22:30',
    });
    expect(planAvailabilitySave(saved, widened)).toEqual(['hours', 'meals']);
  });
});

describe('availability validation', () => {
  it('checks meal times against the draft hours in plain wording', () => {
    const saved = buildSaved();
    const draft = patchWeekday(saved, 2, { closesAt: '21:00' });
    const errors = validateAvailabilityDraft(draft, getDirtyAvailabilityGroups(saved, draft));

    expect(errors['w2-dinner-end']).toBe('Dinner ends after closing (21:00)');
  });

  it('explains hours past midnight, slot spacing, fixed times and duplicate special dates', () => {
    const saved = buildSaved();
    const draft = {
      ...patchWeekday(saved, 3, {
        opensAt: '18:00',
        closesAt: '02:00',
        reservationIntervalMinutes: '200',
        reservationSlotTimes: '12:00, noon',
      }),
      overrideRows: [...saved.overrideRows, { ...saved.overrideRows[0]!, id: 'dup' }],
    };
    const errors = validateAvailabilityDraft(draft, []);

    expect(errors['w3-closes']).toBe(
      'Closing must be after opening. Online booking doesn’t support hours past midnight.',
    );
    expect(errors['w3-interval']).toBe('Enter a whole number from 1 to 180, or leave blank');
    expect(errors['w3-slots']).toBe('Use 24-hour times separated by commas, e.g. 12:00, 12:30');
    expect(errors['o-dup-date']).toBe('Two special dates share this date');
    expect(errors['o-christmas-date']).toBe('Two special dates share this date');
  });

  it('keeps booking rule limits and requires Lunch and Dinner before meal times save', () => {
    const saved = buildSaved([]);
    const draft = {
      ...patchMeal(saved, 2, 'lunch', { startTime: '12:15' }),
      rules: {
        ...saved.rules,
        reservationLastSeatingBufferMinutes: '10',
        reservationLifecycleGraceMinutes: '121',
      },
    };
    const errors = validateAvailabilityDraft(draft, getDirtyAvailabilityGroups(saved, draft));

    expect(errors['r-buffer']).toBe('Enter a whole number from 15 to 300');
    expect(errors['r-grace']).toBe('Enter a whole number from 0 to 120');
    expect(errors['types-required']).toBe(
      'Meal times can’t be saved until Lunch and Dinner booking types exist',
    );
    expect(orderAvailabilityErrorKeys(errors)[0]).toBe('types-required');
  });

  it('groups errors so a day’s errors show once any of its fields is touched', () => {
    expect(availabilityErrorGroup('w2-dinner-end')).toBe('w2-');
    expect(availabilityErrorGroup('o-8f6c1b2e-aaaa-bbbb-cccc-000000000000-closes')).toBe(
      'o-8f6c1b2e-aaaa-bbbb-cccc-000000000000',
    );
    expect(availabilityErrorGroup('r-buffer')).toBe('r-buffer');
  });
});

describe('availability attention checks', () => {
  it('flags fixed start times outside meal times, empty meal windows and switched-off types', () => {
    const saved = buildSaved([occasion('lunch', false), occasion('dinner')]);
    const draft = patchWeekday(saved, 2, { reservationSlotTimes: '11:00, 12:30, 16:00' });
    const items = buildAvailabilityAttention({
      draft,
      errors: {},
      offeredCount: (dayOfWeek, meal) => (dayOfWeek === 4 && meal === 'dinner' ? 0 : 3),
      googleDriftCount: 2,
    });
    const texts = items.map((item) => item.text);

    expect(texts).toContain(
      'Tuesday: 2 fixed start times (11:00, 16:00) are outside lunch and dinner, so guests won’t see them.',
    );
    expect(texts).toContain('Thursday dinner is on, but no times can be offered to a party of 2.');
    expect(
      texts.some((text) =>
        text.startsWith('The Lunch booking type is off while lunch meal times are set on 6 days.'),
      ),
    ).toBe(true);
    expect(texts).toContain(
      'Google Business Profile differs on 2 opening-hours or meal-time fields.',
    );
  });

  it('offers to create Lunch and Dinner and to show the first issue', () => {
    const items = buildAvailabilityAttention({
      draft: buildSaved([]),
      errors: { 'r-buffer': 'Enter a whole number from 15 to 300' },
      offeredCount: () => 1,
      googleDriftCount: 0,
    });
    expect(items.map((item) => item.actionLabel)).toEqual([
      'Show first issue',
      'Create Lunch and Dinner',
    ]);
  });
});

describe('preview time ranges', () => {
  it('collapses consecutive times at the day’s spacing', () => {
    expect(formatTimeRanges(['12:00', '12:15', '12:30', '14:00'], 15)).toBe(
      '12:00–12:30 (3), 14:00',
    );
  });
});
