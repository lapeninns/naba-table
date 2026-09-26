import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  OnboardingProvider,
  useOnboarding,
} from '@/components/features/onboarding/context/OnboardingContext';
import {
  AccountStep,
  ProfileStep,
} from '@/components/features/onboarding/OnboardingAccountProfileSteps';
import {
  HoursStep,
  ServicePeriodsStep,
} from '@/components/features/onboarding/OnboardingScheduleSteps';
import {
  ReviewStep,
  TablesStep,
} from '@/components/features/onboarding/OnboardingTablesReviewSteps';

import { createQueryWrapper, createTestQueryClient } from '../../utils/reactQuery';

import type * as OnboardingLaunchModule from '@/components/features/onboarding/onboardingLaunch';
import type { OnboardingState } from '@/components/features/onboarding/types';

const navigateToOpsDashboardMock = vi.hoisted(() => vi.fn());
const writeBrowserOpsRestaurantCookieMock = vi.hoisted(() => vi.fn());
const routerPushMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPushMock, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/onboarding',
}));

vi.mock('@/lib/analytics', () => ({ track: vi.fn() }));
vi.mock('@/lib/analytics/emit', () => ({ emit: vi.fn() }));

vi.mock('@/lib/ops/session', () => ({
  writeBrowserOpsRestaurantCookie: writeBrowserOpsRestaurantCookieMock,
}));

vi.mock('@/components/features/onboarding/onboardingLaunch', async () => {
  const actual = await vi.importActual<typeof OnboardingLaunchModule>(
    '@/components/features/onboarding/onboardingLaunch',
  );
  return { ...actual, navigateToOpsDashboard: navigateToOpsDashboardMock };
});

const STORAGE_KEY = 'nabatable:onboarding:draft:v1';
const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';

type FetchCall = { url: string; method: string; body: unknown };

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

let fetchCalls: FetchCall[] = [];
let respond: (call: FetchCall) => Response;

function StateProbe() {
  const { state } = useOnboarding();
  return (
    <>
      <span data-testid="step">{state.step}</span>
      <span data-testid="restaurant-id">{state.restaurantId ?? ''}</span>
      <span data-testid="error">{state.error ?? ''}</span>
      <span data-testid="account">{state.account?.email ?? ''}</span>
    </>
  );
}

function renderStep(ui: React.ReactNode, initialState: Partial<OnboardingState> = {}) {
  const Wrapper = createQueryWrapper(createTestQueryClient());
  return render(
    <Wrapper>
      <OnboardingProvider initialState={initialState}>
        {ui}
        <StateProbe />
      </OnboardingProvider>
    </Wrapper>,
  );
}

beforeEach(() => {
  window.sessionStorage.clear();
  fetchCalls = [];
  respond = () => jsonResponse(500, { error: 'unexpected', code: 'INTERNAL_ERROR' });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const call: FetchCall = {
        url: String(input),
        method: init?.method ?? 'GET',
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      };
      fetchCalls.push(call);
      return respond(call);
    }),
  );
  navigateToOpsDashboardMock.mockReset();
  writeBrowserOpsRestaurantCookieMock.mockReset();
  routerPushMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AccountStep sign-up states', () => {
  it('stays on step 1 and asks to confirm the email when there is no session yet', async () => {
    respond = () =>
      jsonResponse(202, { status: 'magic_link_sent', redirectTo: '/onboarding/profile' });
    renderStep(<AccountStep onComplete={vi.fn()} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), {
      target: { value: 'owner@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('Check your email to confirm')).toBeInTheDocument();
    expect(screen.getByTestId('step')).toHaveTextContent('1');
    // No account is recorded, so steps 2+ stay locked until a real session exists.
    expect(screen.getByTestId('account')).toHaveTextContent('');
    expect(fetchCalls).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: "I've confirmed my email" }));
    expect(routerPushMock).toHaveBeenCalledWith('/onboarding/profile');
  });

  it('advances to the profile step when sign-up returns a session', async () => {
    respond = () => jsonResponse(201, { status: 'ok', redirectTo: '/onboarding/profile' });
    renderStep(<AccountStep onComplete={vi.fn()} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), {
      target: { value: 'owner@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(screen.getByTestId('step')).toHaveTextContent('2'));
    expect(screen.getByTestId('account')).toHaveTextContent('owner@example.com');
  });

  it('offers to continue when the server already reports a session', () => {
    renderStep(<AccountStep onComplete={vi.fn()} />, { session: { email: 'owner@example.com' } });

    expect(
      screen.getByText('Continue setting up your restaurant as owner@example.com.'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByTestId('step')).toHaveTextContent('2');
    expect(fetchCalls).toHaveLength(0);
  });

  it('shows safe copy instead of a server 5xx message', async () => {
    respond = () =>
      jsonResponse(500, {
        error: 'db exploded at host x',
        code: 'INTERNAL_ERROR',
        message: 'db exploded at host x',
      });
    renderStep(<AccountStep onComplete={vi.fn()} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), {
      target: { value: 'owner@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() =>
      expect(screen.getByTestId('error')).toHaveTextContent(
        'Something went wrong on our side. Try again.',
      ),
    );
    expect(screen.getByTestId('error')).not.toHaveTextContent('db exploded');
  });
});

const SAVED_PROFILE = {
  name: 'The Local',
  slug: 'the-local',
  timezone: 'Europe/London',
  contactEmail: '',
  contactPhone: '',
  bookingPolicy: '',
};

describe('ProfileStep create vs update', () => {
  it('creates the restaurant on first save', async () => {
    respond = () =>
      jsonResponse(201, {
        restaurant: {
          id: RESTAURANT_ID,
          name: 'The Local',
          slug: 'the-local-ab12',
          timezone: 'Europe/London',
        },
      });
    renderStep(<ProfileStep onComplete={vi.fn()} />, {
      step: 2,
      session: { email: null },
      profile: { ...SAVED_PROFILE, name: '', slug: '' },
    });

    fireEvent.change(screen.getByRole('textbox', { name: 'Restaurant name' }), {
      target: { value: 'The Local' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Slug' }), {
      target: { value: 'the-local' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => expect(screen.getByTestId('step')).toHaveTextContent('3'));
    expect(fetchCalls).toEqual([
      expect.objectContaining({ url: '/api/onboarding/restaurant', method: 'POST' }),
    ]);
    expect(screen.getByTestId('restaurant-id')).toHaveTextContent(RESTAURANT_ID);
  });

  it('skips the write when going back and forward without changes', async () => {
    renderStep(<ProfileStep onComplete={vi.fn()} />, {
      step: 2,
      restaurantId: RESTAURANT_ID,
      profile: SAVED_PROFILE,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => expect(screen.getByTestId('step')).toHaveTextContent('3'));
    expect(fetchCalls).toHaveLength(0);
  });

  it('updates the existing restaurant instead of re-creating it (no 409)', async () => {
    respond = () =>
      jsonResponse(200, {
        restaurant: {
          id: RESTAURANT_ID,
          name: 'The New Local',
          slug: 'the-local',
          timezone: 'Europe/London',
        },
      });
    renderStep(<ProfileStep onComplete={vi.fn()} />, {
      step: 2,
      restaurantId: RESTAURANT_ID,
      profile: SAVED_PROFILE,
    });

    fireEvent.change(screen.getByRole('textbox', { name: 'Restaurant name' }), {
      target: { value: 'The New Local' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => expect(screen.getByTestId('step')).toHaveTextContent('3'));
    // Only the changed field goes to the onboarding profile route; the unchanged slug is
    // not re-sent, so it cannot trip the slug check.
    expect(fetchCalls).toEqual([
      {
        url: `/api/onboarding/restaurant/${RESTAURANT_ID}/profile`,
        method: 'PATCH',
        body: { name: 'The New Local' },
      },
    ]);
  });

  it('puts a slug clash from the update on the slug field', async () => {
    respond = () =>
      jsonResponse(409, {
        error: 'That web address is taken. Try a different slug.',
        code: 'SLUG_TAKEN',
        message: 'That web address is taken. Try a different slug.',
        fields: { slug: ['That web address is taken. Try a different slug.'] },
      });
    renderStep(<ProfileStep onComplete={vi.fn()} />, {
      step: 2,
      restaurantId: RESTAURANT_ID,
      profile: SAVED_PROFILE,
    });

    fireEvent.change(screen.getByRole('textbox', { name: 'Slug' }), {
      target: { value: 'taken-slug' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(
      await screen.findAllByText('That web address is taken. Try a different slug.'),
    ).toHaveLength(2);
    expect(fetchCalls[0]?.body).toEqual({ slug: 'taken-slug' });
    expect(screen.getByTestId('step')).toHaveTextContent('2');
  });

  it('catches a malformed slug before any request', async () => {
    renderStep(<ProfileStep onComplete={vi.fn()} />, {
      step: 2,
      restaurantId: RESTAURANT_ID,
      profile: SAVED_PROFILE,
    });

    fireEvent.change(screen.getByRole('textbox', { name: 'Slug' }), {
      target: { value: 'My Slug' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(
      await screen.findByText(
        'Use lowercase letters, numbers and single hyphens, like the-old-crown',
      ),
    ).toBeInTheDocument();
    expect(fetchCalls).toHaveLength(0);
  });

  it('puts a taken slug on the slug field', async () => {
    respond = () =>
      jsonResponse(409, {
        error: 'That web address is taken. Try a different slug.',
        code: 'SLUG_TAKEN',
        message: 'That web address is taken. Try a different slug.',
        fields: { slug: ['That web address is taken. Try a different slug.'] },
      });
    renderStep(<ProfileStep onComplete={vi.fn()} />, {
      step: 2,
      session: { email: null },
      profile: SAVED_PROFILE,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(
      await screen.findAllByText('That web address is taken. Try a different slug.'),
    ).not.toHaveLength(0);
    expect(screen.getByTestId('step')).toHaveTextContent('2');
  });
});

describe('TablesStep layout replace', () => {
  it('saves zones and tables in one idempotent PUT and stores the canonical rows', async () => {
    respond = () =>
      jsonResponse(200, {
        data: {
          zones: [{ id: 'zone-1', name: 'Main Dining', sortOrder: 0, active: true }],
          tables: [{ id: 'table-1', tableNumber: 'T1', capacity: 2, zoneId: 'zone-1' }],
        },
      });
    renderStep(<TablesStep onComplete={vi.fn()} />, { step: 5, restaurantId: RESTAURANT_ID });

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => expect(screen.getByTestId('step')).toHaveTextContent('6'));
    expect(fetchCalls).toEqual([
      {
        url: `/api/onboarding/restaurant/${RESTAURANT_ID}/layout`,
        method: 'PUT',
        body: {
          zones: [{ name: 'Main Dining', sortOrder: 0, active: true }],
          tables: [{ tableNumber: 'T1', capacity: 2, zoneName: null }],
        },
      },
    ]);
  });

  it('explains a locked layout with actionable copy', async () => {
    respond = () =>
      jsonResponse(409, {
        error: 'locked',
        code: 'ONBOARDING_LAYOUT_LOCKED',
        message: 'locked',
      });
    renderStep(<TablesStep onComplete={vi.fn()} />, { step: 5, restaurantId: RESTAURANT_ID });

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() =>
      expect(screen.getByTestId('error')).toHaveTextContent(
        'This restaurant already has bookings, so change its tables from Tables in the dashboard.',
      ),
    );
  });
});

describe('TablesStep table numbers', () => {
  it('never repeats a number after remove-then-add', async () => {
    renderStep(<TablesStep onComplete={vi.fn()} />, {
      step: 5,
      restaurantId: RESTAURANT_ID,
      tables: [
        { tableNumber: 'T1', capacity: 2 },
        { tableNumber: 'T2', capacity: 2 },
        { tableNumber: 'T3', capacity: 2 },
      ],
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove table' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Add table' }));

    await waitFor(() =>
      expect(
        screen.getAllByPlaceholderText('T1').map((input) => (input as HTMLInputElement).value),
      ).toEqual(['T2', 'T3', 'T4']),
    );
  });

  it('shows duplicate table numbers inline without calling the API', async () => {
    renderStep(<TablesStep onComplete={vi.fn()} />, {
      step: 5,
      restaurantId: RESTAURANT_ID,
      tables: [
        { tableNumber: 'T3', capacity: 2 },
        { tableNumber: 'T3', capacity: 4 },
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByText('Table T3 is already in the list.')).toBeInTheDocument();
    expect(fetchCalls).toHaveLength(0);
  });

  it('puts server field errors on the matching table input', async () => {
    respond = () =>
      jsonResponse(400, {
        error: 'Some fields need attention.',
        code: 'VALIDATION_FAILED',
        message: 'Some fields need attention.',
        fields: { 'tables.0.tableNumber': ['Table number is too long.'] },
      });
    renderStep(<TablesStep onComplete={vi.fn()} />, { step: 5, restaurantId: RESTAURANT_ID });

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByText('Table number is too long.')).toBeInTheDocument();
    expect(screen.getByTestId('step')).toHaveTextContent('5');
  });
});

describe('Schedule steps validation', () => {
  it('shows an overlap inline on the service-period form without calling the API', async () => {
    renderStep(<ServicePeriodsStep onComplete={vi.fn()} />, {
      step: 4,
      restaurantId: RESTAURANT_ID,
      servicePeriods: [
        { name: 'Lunch', dayOfWeek: 1, startTime: '12:00', endTime: '15:00', bookingOption: 'lunch' },
        { name: 'Dinner', dayOfWeek: 1, startTime: '14:00', endTime: '22:00', bookingOption: 'dinner' },
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(
      await screen.findByText('Overlaps "Lunch" on the same day. Adjust the times.'),
    ).toBeInTheDocument();
    expect(fetchCalls).toHaveLength(0);
  });

  it('puts server 400 fields for service periods on the form', async () => {
    respond = () =>
      jsonResponse(400, {
        error: 'Some fields need attention.',
        code: 'VALIDATION_FAILED',
        message: 'Some fields need attention.',
        fields: { 'servicePeriods.0.endTime': ['End time must be after the start time.'] },
      });
    renderStep(<ServicePeriodsStep onComplete={vi.fn()} />, {
      step: 4,
      restaurantId: RESTAURANT_ID,
      servicePeriods: [
        { name: 'Dinner', dayOfWeek: null, startTime: '17:00', endTime: '22:00', bookingOption: 'dinner' },
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByText('End time must be after the start time.')).toBeInTheDocument();
    expect(fetchCalls).toHaveLength(1);
  });

  it('flags an open day with equal times inline and does not save', async () => {
    const hours = Array.from({ length: 7 }, (_, day) => ({
      dayOfWeek: day,
      opensAt: day === 1 ? '09:00' : null,
      closesAt: day === 1 ? '09:00' : null,
      isClosed: day !== 1,
      notes: null,
    }));
    renderStep(<HoursStep onComplete={vi.fn()} />, {
      step: 3,
      restaurantId: RESTAURANT_ID,
      operatingHours: hours,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(
      await screen.findByText('Closing time must differ from the opening time.'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('error')).toHaveTextContent('Check the highlighted days.');
    expect(fetchCalls).toHaveLength(0);
  });
});

describe('ReviewStep launch', () => {
  it('clears the draft, selects the restaurant and opens the dashboard when ready', async () => {
    respond = () => jsonResponse(200, { status: 'ok', ready: true, restaurantId: RESTAURANT_ID });
    renderStep(<ReviewStep />, { step: 6, restaurantId: RESTAURANT_ID });
    await waitFor(() => expect(window.sessionStorage.getItem(STORAGE_KEY)).not.toBeNull());

    fireEvent.click(screen.getByRole('button', { name: 'Launch restaurant' }));

    await waitFor(() => expect(navigateToOpsDashboardMock).toHaveBeenCalledTimes(1));
    expect(writeBrowserOpsRestaurantCookieMock).toHaveBeenCalledWith(RESTAURANT_ID);
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(fetchCalls).toEqual([
      expect.objectContaining({
        url: `/api/onboarding/restaurant/${RESTAURANT_ID}/complete`,
        method: 'POST',
      }),
    ]);
  });

  it('lists what is missing with links back to the steps', async () => {
    respond = () =>
      jsonResponse(409, {
        error: 'Finish the remaining setup steps before launching.',
        code: 'ONBOARDING_INCOMPLETE',
        message: 'Finish the remaining setup steps before launching.',
        details: { missing: ['operating_hours', 'tables'] },
      });
    renderStep(<ReviewStep />, { step: 6, restaurantId: RESTAURANT_ID });

    fireEvent.click(screen.getByRole('button', { name: 'Launch restaurant' }));

    const hoursLink = await screen.findByRole('link', { name: 'Add your opening hours' });
    expect(hoursLink).toHaveAttribute('href', '/onboarding/hours');
    expect(screen.getByRole('link', { name: 'Add at least one table' })).toHaveAttribute(
      'href',
      '/onboarding/tables',
    );
    expect(navigateToOpsDashboardMock).not.toHaveBeenCalled();
    expect(writeBrowserOpsRestaurantCookieMock).not.toHaveBeenCalled();

    fireEvent.click(hoursLink);
    expect(screen.getByTestId('step')).toHaveTextContent('3');
  });
});
