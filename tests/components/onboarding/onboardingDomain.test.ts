import { describe, expect, it } from 'vitest';

import { getMissingRequirements } from '@/components/features/onboarding/onboardingLaunch';
import { applyServerResume } from '@/components/features/onboarding/onboardingResume';
import {
  getMaxAccessibleStep,
  hasProfileChanged,
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
        },
      },
      DEFAULTS,
    );
    expect(next.restaurantId).toBe(RESTAURANT_ID);
    expect(next.profile).toMatchObject({ name: 'The Local', slug: 'the-local' });
    expect(getMaxAccessibleStep(next)).toBe(6);
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
