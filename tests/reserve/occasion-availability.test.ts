import { describe, expect, it } from 'vitest';

import { isOccasionAvailable, type OccasionDefinition } from '@reserve/shared/occasions';

const buildOccasion = (key: string): OccasionDefinition => ({
  key,
  label: key,
  shortLabel: key,
  description: null,
  availability: [],
  defaultDurationMinutes: 90,
  displayOrder: 0,
  isActive: true,
});

describe('isOccasionAvailable', () => {
  it('treats built-in occasions without availability rules as unconstrained by global time', () => {
    const lunch = buildOccasion('lunch');
    const dinner = buildOccasion('dinner');

    expect(
      isOccasionAvailable(lunch, {
        date: '2026-03-24',
        time: '10:00',
        timezone: 'Europe/London',
      }),
    ).toBe(true);

    expect(
      isOccasionAvailable(dinner, {
        date: '2026-03-24',
        time: '23:00',
        timezone: 'Europe/London',
      }),
    ).toBe(true);
  });
});
