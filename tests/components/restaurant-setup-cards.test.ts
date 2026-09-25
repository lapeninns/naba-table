import { describe, expect, it } from 'vitest';

import {
  buildSetupCards,
  statusLabel,
  summarizeReadiness,
  type BuildSetupCardsInput,
} from '@/components/features/restaurant-settings/overview/buildSetupCards';

const liveInput: BuildSetupCardsInput = {
  profileChecks: { name: true, slug: true, timezone: true, contactPhone: true },
  openDays: 6,
  servicePeriodCount: 11,
  totalTables: 14,
  availableTables: 12,
  menuCount: 2,
  pendingInvites: 1,
};

const freshInput: BuildSetupCardsInput = {
  profileChecks: { name: true, slug: true, timezone: true, contactPhone: false },
  openDays: 0,
  servicePeriodCount: 0,
  totalTables: 3,
  availableTables: 0,
  menuCount: 0,
  pendingInvites: 0,
};

describe('restaurant setup rows', () => {
  it('lists what was checked for each required step with counts from the rule inputs', () => {
    const cards = buildSetupCards(liveInput);

    expect(cards.filter((card) => card.group === 'required').map((card) => card.checks)).toEqual([
      [
        { label: 'Restaurant name', ok: true },
        { label: 'Booking page link', ok: true },
        { label: 'Timezone', ok: true },
        { label: 'Public phone', ok: true },
      ],
      [
        { label: '6 days open each week', ok: true },
        { label: '11 meal times set', ok: true },
      ],
      [
        { label: '14 tables added', ok: true },
        { label: '12 bookable now', ok: true },
      ],
    ]);
    expect(cards.map((card) => [card.key, card.status])).toEqual([
      ['profile', 'complete'],
      ['availability', 'complete'],
      ['tables', 'complete'],
      ['discovery', 'optional'],
      ['google', 'optional'],
      ['menu', 'complete'],
      ['team', 'complete'],
    ]);
  });

  it('marks missing checks and keeps the current optional rules and wording', () => {
    const cards = buildSetupCards(freshInput);
    const byKey = Object.fromEntries(cards.map((card) => [card.key, card]));

    expect(byKey.profile?.status).toBe('attention');
    expect(byKey.profile?.checks.find((check) => check.label === 'Public phone')?.ok).toBe(false);
    expect(byKey.availability?.checks).toEqual([
      { label: '0 days open each week', ok: false },
      { label: '0 meal times set', ok: false },
    ]);
    expect(byKey.tables?.checks).toEqual([
      { label: '3 tables added', ok: true },
      { label: '0 bookable now', ok: false },
    ]);
    expect(byKey.tables?.status).toBe('attention');
    expect(byKey.google).toMatchObject({ status: 'optional', checks: [] });
    // Discovery is findable from the overview but never becomes a booking prerequisite.
    expect(byKey.discovery).toMatchObject({ group: 'optional', status: 'optional', checks: [] });
    expect(byKey.menu).toMatchObject({
      status: 'optional',
      reason: 'Add later when menus are ready.',
    });
    expect(byKey.team).toMatchObject({
      status: 'optional',
      reason: 'Invite trusted staff when operations are ready.',
    });
  });

  it('uses singular wording for single counts', () => {
    const cards = buildSetupCards({
      ...liveInput,
      openDays: 1,
      servicePeriodCount: 1,
      totalTables: 1,
      availableTables: 1,
      menuCount: 1,
    });
    const labels = cards.flatMap((card) => card.checks.map((check) => check.label));

    expect(labels).toEqual(
      expect.arrayContaining(['1 day open each week', '1 meal time set', '1 table added']),
    );
    expect(cards.find((card) => card.key === 'menu')?.reason).toBe('1 menu catalogue entry found.');
    expect(cards.find((card) => card.key === 'team')?.reason).toBe('1 pending invite.');
  });

  it('links each row to its real settings route', () => {
    expect(buildSetupCards(liveInput).map((card) => [card.cta, card.href])).toEqual([
      ['Open profile', '/app/settings/restaurant/profile'],
      ['Open availability', '/app/settings/restaurant/availability#weekly-hours'],
      ['Open tables', '/app/settings/restaurant/tables'],
      ['Open discovery', '/app/settings/restaurant/discovery'],
      ['Manage Google', '/app/settings/restaurant/google-business-profile'],
      ['Open menu', '/app/settings/restaurant/menu'],
      ['Open team', '/app/settings/restaurant/team'],
    ]);
  });

  it('replaces a failed row with a "Couldn’t check" status and hides its checks', () => {
    const cards = buildSetupCards({ ...liveInput, failedKeys: new Set(['tables']) });
    const tables = cards.find((card) => card.key === 'tables');

    expect(tables).toMatchObject({
      status: 'unknown',
      checks: [],
      reason:
        'The tables check didn’t respond, so this status may be out of date. Saved settings are unchanged.',
    });
    expect(statusLabel('unknown')).toBe('Couldn’t check');
  });
});

describe('summarizeReadiness', () => {
  it('reports ready when every required step is complete', () => {
    expect(summarizeReadiness(buildSetupCards(liveInput))).toMatchObject({
      ready: true,
      complete: 3,
      total: 3,
      nextKey: null,
      segments: [true, true, true],
      title: 'Ready to take bookings',
      description: '3 of 3 required steps complete. Guests can request times on your booking page.',
      progressLabel: '3 of 3 required steps complete',
    });
  });

  it('names the first incomplete required step as next', () => {
    expect(
      summarizeReadiness(
        buildSetupCards({
          ...freshInput,
          profileChecks: { ...freshInput.profileChecks, contactPhone: true },
        }),
      ),
    ).toMatchObject({
      ready: false,
      complete: 1,
      nextKey: 'availability',
      segments: [true, false, false],
      title: 'Not ready for bookings yet',
      description: '1 of 3 required steps complete. Next: booking availability.',
    });
  });

  it('does not claim readiness or pick a primary step while a required check failed', () => {
    const summary = summarizeReadiness(
      buildSetupCards({ ...liveInput, failedKeys: new Set(['profile']) }),
    );

    expect(summary).toMatchObject({
      ready: false,
      hasFailedCheck: true,
      complete: 2,
      nextKey: null,
      title: 'Some checks couldn’t run',
      description: 'Showing the last known status. Try the check again.',
    });
  });

  it('ignores failures in optional rows for readiness', () => {
    const summary = summarizeReadiness(
      buildSetupCards({ ...liveInput, failedKeys: new Set(['menu', 'team']) }),
    );

    expect(summary).toMatchObject({ ready: true, hasFailedCheck: false });
  });
});
