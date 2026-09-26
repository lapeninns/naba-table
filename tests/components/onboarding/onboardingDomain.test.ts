import { describe, expect, it } from 'vitest';

import { getMissingRequirements } from '@/components/features/onboarding/onboardingLaunch';
import { applyServerResume } from '@/components/features/onboarding/onboardingResume';
import {
  getMaxAccessibleStep,
  getProfileChanges,
  hasProfileChanged,
  profileSchema,
  servicePeriodsFormSchema,
  tablesFormSchema,
} from '@/components/features/onboarding/onboardingWizardDomain';
import { HttpError } from '@/lib/http/errors';

import type { OnboardingState } from '@/components/features/onboarding/types';

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';

const DEFAULTS: OnboardingState = {
  step: 1,
  restaurantId: null,
  account: undefined,
  profile: { name: '', slug: '', timezone: 'Europe/London' },
  operatingHours: [],
  servicePeriods: [],
  zones: [],
  tables: [],
  layoutRevision: null,
  loading: false,
  error: null,
};

describe('applyServerResume', () => {
  it('keeps the draft when the server lookup was unavailable', () => {
    const draft = { ...DEFAULTS, restaurantId: RESTAURANT_ID, step: 4 as const };
    expect(applyServerResume(draft, undefined, DEFAULTS)).toBe(draft);
  });

  it('marks a signed-out visitor without discarding the draft', () => {
    const draft = { ...DEFAULTS, restaurantId: RESTAURANT_ID };
    const next = applyServerResume(
      draft,
      { session: null, memberRestaurantIds: [], resumeRestaurant: null },
      DEFAULTS,
    );
    expect(next.session).toBeNull();
    expect(next.restaurantId).toBe(RESTAURANT_ID);
  });

  it('opens the profile step after the confirmation hop (new tab, empty draft)', () => {
    const next = applyServerResume(
      { ...DEFAULTS, step: 2 },
      {
        session: { email: 'owner@example.com' },
        memberRestaurantIds: [],
        resumeRestaurant: null,
      },
      DEFAULTS,
    );
    expect(next.session).toEqual({ email: 'owner@example.com' });
    expect(getMaxAccessibleStep(next)).toBe(2);
    // The email is only in memory; the persisted draft never gets the session.
    expect(next.account).toBeUndefined();
  });

  it('continues the owner’s unfinished restaurant when the draft was lost', () => {
    const next = applyServerResume(
      { ...DEFAULTS, step: 3 },
      {
        session: { email: null },
        memberRestaurantIds: [RESTAURANT_ID],
        resumeRestaurant: {
          id: RESTAURANT_ID,
          name: 'The Local',
          slug: 'the-local',
          timezone: 'Europe/London',
          setup: null,
        },
      },
      DEFAULTS,
    );
    expect(next.restaurantId).toBe(RESTAURANT_ID);
    expect(next.profile).toMatchObject({ name: 'The Local', slug: 'the-local' });
    expect(getMaxAccessibleStep(next)).toBe(6);
    // Setup could not be read: the steps keep their defaults.
    expect(next.zones).toEqual([]);
  });

  it('loads the saved hours, service periods and layout of a resumed restaurant', () => {
    const setup = {
      operatingHours: [
        { dayOfWeek: 1, opensAt: '12:00', closesAt: '22:00', isClosed: false, notes: null },
      ],
      servicePeriods: [
        {
          id: 'sp-1',
          name: 'Dinner',
          dayOfWeek: null,
          startTime: '17:00',
          endTime: '22:00',
          bookingOption: 'dinner',
        },
      ],
      zones: [{ id: 'zone-1', name: 'Terrace', sortOrder: 0, active: true }],
      tables: [{ id: 'table-1', tableNumber: 'T7', capacity: 4, zoneId: 'zone-1' }],
      layoutRevision: 'rev-7',
    };
    const next = applyServerResume(
      { ...DEFAULTS, step: 5 },
      {
        session: { email: null },
        memberRestaurantIds: [RESTAURANT_ID],
        resumeRestaurant: {
          id: RESTAURANT_ID,
          name: 'The Local',
          slug: 'the-local',
          timezone: 'Europe/London',
          setup,
        },
      },
      DEFAULTS,
    );
    expect(next.operatingHours).toEqual(setup.operatingHours);
    expect(next.servicePeriods).toEqual(setup.servicePeriods);
    expect(next.zones).toEqual(setup.zones);
    expect(next.tables).toEqual(setup.tables);
    // The Tables step saves against the revision the resumed layout was read at.
    expect(next.layoutRevision).toBe('rev-7');
  });

  it('keeps a draft whose restaurant belongs to the signed-in user', () => {
    const draft = { ...DEFAULTS, restaurantId: RESTAURANT_ID, zones: [{ name: 'Bar' }] };
    const next = applyServerResume(
      draft,
      {
        session: { email: null },
        memberRestaurantIds: [RESTAURANT_ID],
        resumeRestaurant: null,
      },
      DEFAULTS,
    );
    expect(next.restaurantId).toBe(RESTAURANT_ID);
    expect(next.zones).toEqual([{ name: 'Bar' }]);
    expect(next.alreadyOnboarded).toBe(false);
  });

  it('never re-runs setup over a finished restaurant', () => {
    const next = applyServerResume(
      { ...DEFAULTS, step: 3 },
      {
        session: { email: null },
        memberRestaurantIds: [RESTAURANT_ID],
        resumeRestaurant: null,
      },
      DEFAULTS,
    );
    expect(next.alreadyOnboarded).toBe(true);
    expect(next.restaurantId).toBeNull();
  });

  it('drops a stale draft restaurant that belongs to another account', () => {
    const next = applyServerResume(
      { ...DEFAULTS, restaurantId: 'someone-else', zones: [{ name: 'Old' }] },
      { session: { email: null }, memberRestaurantIds: [], resumeRestaurant: null },
      DEFAULTS,
    );
    expect(next.restaurantId).toBeNull();
    expect(next.zones).toEqual([]);
    expect(next.alreadyOnboarded).toBe(false);
  });
});

describe('getMaxAccessibleStep', () => {
  it('locks everything after step 1 until there is an account or a session', () => {
    expect(getMaxAccessibleStep(DEFAULTS)).toBe(1);
    expect(getMaxAccessibleStep({ ...DEFAULTS, session: null })).toBe(1);
    expect(getMaxAccessibleStep({ ...DEFAULTS, session: { email: null } })).toBe(2);
  });
});

describe('hasProfileChanged', () => {
  const saved = {
    name: 'The Local',
    slug: 'the-local',
    timezone: 'Europe/London',
    contactEmail: null,
    contactPhone: '',
    bookingPolicy: null,
  };

  it('treats blank and null optional fields as equal', () => {
    expect(
      hasProfileChanged(saved, {
        name: 'The Local ',
        slug: 'the-local',
        timezone: 'Europe/London',
        contactEmail: '',
        contactPhone: '',
        bookingPolicy: '',
      }),
    ).toBe(false);
  });

  it('detects an edited field', () => {
    expect(
      hasProfileChanged(saved, {
        name: 'The Local',
        slug: 'the-local-2',
        timezone: 'Europe/London',
      }),
    ).toBe(true);
  });
});

describe('getMissingRequirements', () => {
  it('reads details.missing from ONBOARDING_INCOMPLETE and ignores unknown values', () => {
    const error = new HttpError({
      status: 409,
      code: 'ONBOARDING_INCOMPLETE',
      message: 'Finish the remaining setup steps before launching.',
      details: { missing: ['tables', 'bogus', 'operating_hours'] },
    });
    expect(getMissingRequirements(error)).toEqual(['tables', 'operating_hours']);
  });

  it('returns null for other errors', () => {
    expect(
      getMissingRequirements(new HttpError({ status: 409, code: 'OTHER', message: 'x' })),
    ).toBeNull();
    expect(getMissingRequirements(new Error('x'))).toBeNull();
  });
});

describe('getProfileChanges', () => {
  const saved = {
    name: 'The Local',
    slug: 'the-local',
    timezone: 'Europe/London',
    contactEmail: 'a@example.com',
    contactPhone: null,
    bookingPolicy: '',
  };

  it('returns only the fields that changed, with blanks as null', () => {
    expect(
      getProfileChanges(saved, {
        name: 'The Local ',
        slug: 'the-local-2',
        timezone: 'Europe/London',
        contactEmail: '',
        contactPhone: '',
        bookingPolicy: '',
      }),
    ).toEqual({ slug: 'the-local-2', contactEmail: null });
  });
});

describe('wizard form schemas mirror the API rules', () => {
  it('rejects a slug the API would refuse', () => {
    const result = profileSchema.safeParse({
      name: 'X',
      slug: 'My Slug',
      timezone: 'Europe/London',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['slug']);
  });

  it('flags overlapping service periods on the later one', () => {
    const result = servicePeriodsFormSchema.safeParse({
      servicePeriods: [
        { name: 'Lunch', dayOfWeek: 1, startTime: '12:00', endTime: '15:00', bookingOption: 'lunch' },
        { name: 'Dinner', dayOfWeek: 1, startTime: '14:00', endTime: '22:00', bookingOption: 'dinner' },
      ],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ['servicePeriods', 1, 'startTime'],
    ]);
  });

  it('flags duplicate table numbers', () => {
    const result = tablesFormSchema.safeParse({
      tables: [
        { tableNumber: 'T3', capacity: 2 },
        { tableNumber: 'T3', capacity: 4 },
      ],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([['tables', 1, 'tableNumber']]);
  });
});
