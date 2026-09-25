import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const availabilityState = vi.hoisted(() => ({
  detailsQuery: {
    data: {
      id: 'rest-1',
      name: 'Old Crown Girton',
      slug: 'old-crown-girton',
      timezone: 'Europe/London',
      contactEmail: 'ops@example.com',
      contactPhone: '+441223277217',
      address: '1 High Street',
      businessDescription: null,
      managerDailySummaryEnabled: false,
      managerNotificationPhone: null,
      googleMapUrl: null,
      googleReviewUrl: null,
      bookingPolicy: null,
      reservationIntervalMinutes: 15,
      reservationDefaultDurationMinutes: 90,
      reservationLastSeatingBufferMinutes: 15,
      reservationLifecycleGraceMinutes: 15,
      updatedAt: null,
    },
    error: null as Error | null,
    isLoading: false,
    refetch: vi.fn(),
  },
  occasionService: {
    createOccasion: vi.fn(),
    updateOccasion: vi.fn(),
    deleteOccasion: vi.fn(),
  },
  occasionsQuery: {
    data: [] as OpsOccasion[],
    error: null as Error | null,
    isLoading: false,
  },
  operatingHoursQuery: {
    data: null as OperatingHoursSnapshot | null,
    error: null as Error | null,
    isLoading: false,
    refetch: vi.fn(),
  },
  servicePeriodsQuery: {
    data: [] as ServicePeriodRow[],
    error: null as Error | null,
    isLoading: false,
  },
  turnBandsQuery: {
    data: null as TurnBandsSnapshot | null,
    error: null as Error | null,
    isLoading: false,
  },
  updateOperatingHours: {
    isPending: false,
    mutateAsync: vi.fn(),
  },
  updateServicePeriods: {
    isPending: false,
    mutateAsync: vi.fn(),
  },
  updateTurnBands: {
    isPending: false,
    mutateAsync: vi.fn(),
  },
  updateDetails: {
    isPending: false,
    mutateAsync: vi.fn(),
  },
  gbpFields: [] as unknown[],
}));

vi.mock('@/contexts/ops-services', () => ({
  useOccasionService: () => availabilityState.occasionService,
}));

vi.mock('@/contexts/ops-unsaved-changes', () => ({
  useRegisterOpsUnsavedChanges: vi.fn(),
  useRegisterOptionalOpsUnsavedChanges: vi.fn(),
}));

const navigationState = vi.hoisted(() => ({ pathname: '/app/settings/restaurant/availability' }));

vi.mock('next/navigation', () => ({
  usePathname: () => navigationState.pathname,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/hooks/useGlobalShortcuts', () => ({
  useGlobalShortcuts: vi.fn(),
}));

vi.mock('@/hooks/ops/useOccasions', () => ({
  useOpsOccasions: () => availabilityState.occasionsQuery,
}));

vi.mock('@/hooks/ops/useOpsOperatingHours', () => ({
  useOpsOperatingHours: () => availabilityState.operatingHoursQuery,
  useOpsUpdateOperatingHours: () => availabilityState.updateOperatingHours,
}));

vi.mock('@/hooks/ops/useOpsServicePeriods', () => ({
  useOpsServicePeriods: () => availabilityState.servicePeriodsQuery,
  useOpsUpdateServicePeriods: () => availabilityState.updateServicePeriods,
}));

vi.mock('@/hooks/ops/useOpsTurnBands', () => ({
  useOpsTurnBands: () => availabilityState.turnBandsQuery,
  useOpsUpdateTurnBands: () => availabilityState.updateTurnBands,
}));

vi.mock('@/hooks/ops/useOpsRestaurantDetails', () => ({
  useOpsRestaurantDetails: () => availabilityState.detailsQuery,
  useOpsUpdateRestaurantDetails: () => availabilityState.updateDetails,
}));

vi.mock('@/hooks/ops/useOpsDualSync', () => ({
  useOpsDualSync: () => ({
    stateQuery: {
      data: { fields: availabilityState.gbpFields },
      error: null,
      isError: false,
      isLoading: false,
    },
  }),
}));

import { AvailabilitySettingsPage } from '@/components/features/restaurant-settings/availability/AvailabilitySettingsPage';
import {
  buildAvailabilityRules,
  createRuleDraft,
  describeRuleDraft,
  formatAvailabilitySummary,
  isServiceWindowOccasion,
  toRuleDrafts,
} from '@/components/features/restaurant-settings/availabilityOccasionsModel';
import {
  buildOperatingHoursPayload,
  buildMissingRequiredOccasions,
  buildWeeklyHoursMap,
  defaultOverrideRow,
  extractRequiredOccasionKeys,
  mapOverridesFromResponse,
  mapWeeklyFromResponse,
  MEAL_LABELS,
} from '@/components/features/restaurant-settings/availabilityScheduleManagerUtils';
import {
  formatKitchenRange,
  parseIntervalInput,
  parseSlotTimesInput,
} from '@/components/features/restaurant-settings/availabilityScheduleTime';
import {
  validateHours,
  validateServices,
} from '@/components/features/restaurant-settings/availabilityScheduleValidation';
import { HttpError } from '@/lib/http/errors';

import type { OpsOccasion } from '@/services/ops/occasions';
import type {
  OperatingHoursSnapshot,
  ServicePeriodRow,
  TurnBandsSnapshot,
} from '@/services/ops/restaurants';

function buildOperatingHours(): OperatingHoursSnapshot {
  return {
    updatedAt: '2026-04-30T12:00:00.000Z',
    weekly: Array.from({ length: 7 }, (_, dayOfWeek) => ({
      dayOfWeek,
      opensAt: '12:00',
      closesAt: '22:00',
      isClosed: false,
      notes: null,
      reservationIntervalMinutes: 15,
      reservationSlotTimes: null,
    })),
    overrides: [],
  };
}

function buildOccasion(overrides: Partial<OpsOccasion> & { key: string }): OpsOccasion {
  return {
    key: overrides.key,
    label: overrides.label ?? overrides.key,
    shortLabel: overrides.shortLabel ?? overrides.label ?? overrides.key,
    description: overrides.description ?? null,
    availability: overrides.availability ?? [{ kind: 'anytime' }],
    defaultDurationMinutes: overrides.defaultDurationMinutes ?? 90,
    displayOrder: overrides.displayOrder ?? 10,
    isActive: overrides.isActive ?? true,
    isBuiltin: overrides.isBuiltin ?? true,
    createdAt: null,
    updatedAt: null,
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
  };
}

function buildServicePeriods(): ServicePeriodRow[] {
  return Array.from({ length: 7 }).flatMap((_, dayOfWeek) => [
    {
      id: `lunch-${dayOfWeek}`,
      name: 'Lunch',
      dayOfWeek,
      startTime: '12:00',
      endTime: '15:00',
      bookingOption: 'lunch',
      updatedAt: null,
    },
    {
      id: `dinner-${dayOfWeek}`,
      name: 'Dinner',
      dayOfWeek,
      startTime: '17:00',
      endTime: '22:00',
      bookingOption: 'dinner',
      updatedAt: null,
    },
  ]);
}

function buildTurnBands(): TurnBandsSnapshot {
  return { restaurantId: 'rest-1', bands: {}, defaults: {} };
}

function setReadyAvailabilityState({
  occasions = [
    buildOccasion({ key: 'lunch', label: 'Lunch', displayOrder: 10 }),
    buildOccasion({ key: 'dinner', label: 'Dinner', displayOrder: 20 }),
  ],
}: {
  occasions?: OpsOccasion[];
} = {}) {
  availabilityState.operatingHoursQuery.data = buildOperatingHours();
  availabilityState.operatingHoursQuery.error = null;
  availabilityState.servicePeriodsQuery.data = buildServicePeriods();
  availabilityState.servicePeriodsQuery.error = null;
  availabilityState.occasionsQuery.data = occasions;
  availabilityState.occasionsQuery.error = null;
  availabilityState.turnBandsQuery.data = buildTurnBands();
  availabilityState.turnBandsQuery.error = null;
}

function renderPage(restaurantId: string | null = 'rest-1') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AvailabilitySettingsPage restaurantId={restaurantId} />
    </QueryClientProvider>,
  );
}

async function openMonday(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /^Monday/ }));
}

describe('AvailabilitySettingsPage', () => {
  beforeEach(() => {
    navigationState.pathname = '/app/settings/restaurant/availability';
    window.history.replaceState(null, '', '/app/settings/restaurant/availability');
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    Element.prototype.scrollIntoView = vi.fn();
    availabilityState.detailsQuery.error = null;
    availabilityState.gbpFields = [];
    for (const service of Object.values(availabilityState.occasionService)) {
      service.mockReset();
    }
    availabilityState.occasionService.createOccasion.mockImplementation(async (input) =>
      buildOccasion({ key: input.key, label: input.label }),
    );
    for (const mutation of [
      availabilityState.updateOperatingHours,
      availabilityState.updateServicePeriods,
      availabilityState.updateTurnBands,
      availabilityState.updateDetails,
    ]) {
      mutation.mutateAsync.mockReset();
      mutation.mutateAsync.mockImplementation(async (payload: unknown) => payload);
    }
    availabilityState.updateDetails.mutateAsync.mockImplementation(async (payload: object) => ({
      ...availabilityState.detailsQuery.data,
      ...payload,
    }));
    setReadyAvailabilityState();
  });

  it('shows one page with every section, a saved status and no save bar while clean', async () => {
    renderPage();

    expect(
      await screen.findByRole('heading', { name: 'Weekly hours and meal times' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Special dates' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Booking rules' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Booking types and table times' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Booking preview' })).toBeInTheDocument();
    expect(screen.getByText('All changes saved')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Unsaved changes' })).not.toBeInTheDocument();
    expect(screen.getByText(/Configuration preview, not live availability\./)).toBeInTheDocument();
  });

  it('checks meal times against the draft hours and blocks saving until fixed', async () => {
    const user = userEvent.setup();
    renderPage();
    await openMonday(user);

    const closes = screen.getByLabelText('Closes', { selector: '#availability-w1-closes' });
    await user.clear(closes);
    await user.type(closes, '21:00');
    await user.tab();

    expect(await screen.findByText('Dinner ends after closing (21:00)')).toBeInTheDocument();
    expect(screen.getByText('1 issue to fix before saving')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(availabilityState.updateOperatingHours.mutateAsync).not.toHaveBeenCalled();
    expect(availabilityState.updateServicePeriods.mutateAsync).not.toHaveBeenCalled();
  });

  it('writes meal times before hours when a day closes earlier, sending weekly and special dates together', async () => {
    const user = userEvent.setup();
    const calls: string[] = [];
    availabilityState.updateServicePeriods.mutateAsync.mockImplementation(
      async (payload: unknown) => {
        calls.push('meals');
        return payload;
      },
    );
    availabilityState.updateOperatingHours.mutateAsync.mockImplementation(
      async (payload: unknown) => {
        calls.push('hours');
        return payload;
      },
    );
    renderPage();
    await openMonday(user);

    const closes = screen.getByLabelText('Closes', { selector: '#availability-w1-closes' });
    await user.clear(closes);
    await user.type(closes, '21:00');
    const dinnerEnd = screen.getAllByLabelText('Meal time ends')[1]!;
    await user.clear(dinnerEnd);
    await user.type(dinnerEnd, '21:00');

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(calls).toEqual(['meals', 'hours']));
    const hoursPayload = availabilityState.updateOperatingHours.mutateAsync.mock
      .calls[0]![0] as OperatingHoursSnapshot;
    expect(hoursPayload.weekly.find((row) => row.dayOfWeek === 1)?.closesAt).toBe('21:00');
    expect(hoursPayload.overrides).toEqual([]);
    expect(await screen.findByText('All changes saved')).toBeInTheDocument();
  });

  it('writes hours before meal times when a day opens longer', async () => {
    const user = userEvent.setup();
    const calls: string[] = [];
    availabilityState.updateServicePeriods.mutateAsync.mockImplementation(
      async (payload: unknown) => {
        calls.push('meals');
        return payload;
      },
    );
    availabilityState.updateOperatingHours.mutateAsync.mockImplementation(
      async (payload: unknown) => {
        calls.push('hours');
        return payload;
      },
    );
    renderPage();
    await openMonday(user);

    const closes = screen.getByLabelText('Closes', { selector: '#availability-w1-closes' });
    await user.clear(closes);
    await user.type(closes, '23:00');
    const dinnerEnd = screen.getAllByLabelText('Meal time ends')[1]!;
    await user.clear(dinnerEnd);
    await user.type(dinnerEnd, '22:30');

    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(calls).toEqual(['hours', 'meals']));
  });

  it('reports a partial failure with what saved, what did not and the reason code', async () => {
    const user = userEvent.setup();
    availabilityState.updateOperatingHours.mutateAsync.mockRejectedValue(
      new HttpError({ message: 'Internal Server Error', status: 500, code: 'HTTP_500' }),
    );
    renderPage();
    await openMonday(user);

    const closes = screen.getByLabelText('Closes', { selector: '#availability-w1-closes' });
    await user.clear(closes);
    await user.type(closes, '23:00');
    const interval = screen.getByLabelText('Decrease time between booking slots by 5 minutes');
    await user.click(interval);

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText(
        'Opening hours and special dates not saved. Your edits are still here.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Not attempted: Booking rules\./)).toBeInTheDocument();
    expect(screen.getByText('HTTP_500', { selector: '.font-mono' })).toBeInTheDocument();
    expect(screen.getByText('Not all changes saved')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(availabilityState.updateDetails.mutateAsync).not.toHaveBeenCalled();
  });

  it('saves booking rules through the restaurant details endpoint', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByLabelText('Increase last seating before closing by 15 minutes'),
    );
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(availabilityState.updateDetails.mutateAsync).toHaveBeenCalledWith({
        bookingPolicy: null,
        reservationIntervalMinutes: 15,
        reservationLastSeatingBufferMinutes: 30,
        reservationLifecycleGraceMinutes: 15,
      }),
    );
    // The default table time saves with Booking types and table times, not with the rules.
    expect(availabilityState.updateDetails.mutateAsync).toHaveBeenCalledTimes(1);
    expect(availabilityState.updateOperatingHours.mutateAsync).not.toHaveBeenCalled();
  });

  it('edits the default table time in one place, beside the booking types', async () => {
    renderPage();

    const typesCard = await waitFor(() => {
      const element = document.getElementById('booking-occasions');
      expect(element).not.toBeNull();
      return element as HTMLElement;
    });
    const rulesCard = document.getElementById('booking-rules') as HTMLElement;

    expect(screen.getAllByRole('textbox', { name: 'Default table time' })).toHaveLength(1);
    expect(within(typesCard).getByRole('textbox', { name: 'Default table time' })).toHaveValue(
      '90',
    );
    expect(within(rulesCard).queryByText('Default table time')).not.toBeInTheDocument();
    // Slot spacing, last seating, grace period and policy stay in Booking rules.
    expect(within(rulesCard).getByText('Time between booking slots')).toBeInTheDocument();
    expect(within(rulesCard).getByText('Last seating before closing')).toBeInTheDocument();
    expect(within(rulesCard).getByText('Late grace period and booking policy')).toBeInTheDocument();
  });

  it('saves, reviews and undoes the default table time with Booking types and table times', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByLabelText('Increase default table time by 15 minutes'));

    const rail = screen.getByRole('navigation', { name: 'Sections on this page' });
    expect(within(rail).getByRole('link', { name: /Booking types/ })).toHaveTextContent('1');
    expect(within(rail).getByRole('link', { name: /Booking rules/ })).not.toHaveTextContent('1');

    await user.click(screen.getByRole('button', { name: 'Review changes' }));
    const dialog = await screen.findByTestId('settings-review-changes');
    expect(dialog).toHaveTextContent('Booking types and table times');
    expect(dialog).toHaveTextContent('Default table time');
    expect(dialog).not.toHaveTextContent('Booking rules');
    await user.click(
      screen.getByRole('button', { name: /Undo section Booking types and table times/ }),
    );
    await waitFor(() => expect(screen.getByText('All changes saved')).toBeInTheDocument());
    await user.keyboard('{Escape}');

    await user.click(screen.getByLabelText('Increase default table time by 15 minutes'));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(availabilityState.updateDetails.mutateAsync).toHaveBeenCalledWith({
        reservationDefaultDurationMinutes: 105,
      }),
    );
    expect(availabilityState.updateDetails.mutateAsync).toHaveBeenCalledTimes(1);
    expect(availabilityState.updateTurnBands.mutateAsync).not.toHaveBeenCalled();
    expect(availabilityState.occasionService.createOccasion).not.toHaveBeenCalled();
    expect(availabilityState.occasionService.updateOccasion).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText('All changes saved')).toBeInTheDocument());
  });

  it('reports a failed default table time save without claiming the section saved', async () => {
    const user = userEvent.setup();
    availabilityState.updateDetails.mutateAsync.mockRejectedValue(
      new HttpError({ message: 'Forbidden', status: 403, code: 'FORBIDDEN' }),
    );
    renderPage();

    await user.click(await screen.findByLabelText('Increase default table time by 15 minutes'));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText(
        'Booking types and table times not saved. Your edits are still here.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('FORBIDDEN', { selector: '.font-mono' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Default table time' })).toHaveValue('105');
    expect(availabilityState.updateTurnBands.mutateAsync).not.toHaveBeenCalled();
  });

  it('flags an out-of-range default table time in Booking types and table times', async () => {
    const user = userEvent.setup();
    renderPage();

    const field = await screen.findByRole('textbox', { name: 'Default table time' });
    await user.clear(field);
    await user.type(field, '5');
    await user.tab();

    const rail = screen.getByRole('navigation', { name: 'Sections on this page' });
    await waitFor(() =>
      expect(within(rail).getByRole('link', { name: /Booking types/ })).toHaveTextContent('1'),
    );
    expect(field).toHaveAttribute('aria-invalid', 'true');
  });

  it('lists was → now changes and undoes a section from Review changes', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByLabelText('Increase last seating before closing by 15 minutes'),
    );
    await user.click(screen.getByRole('button', { name: 'Review changes' }));

    const dialog = await screen.findByTestId('settings-review-changes');
    expect(dialog).toHaveTextContent('Last seating before closing');
    expect(dialog).toHaveTextContent('15 min');
    expect(dialog).toHaveTextContent('30 min');

    await user.click(screen.getByRole('button', { name: /Undo section Booking rules/ }));
    await waitFor(() => expect(screen.getByText('All changes saved')).toBeInTheDocument());
  });

  it('adds Lunch and Dinner to the draft and creates them on save', async () => {
    const user = userEvent.setup();
    setReadyAvailabilityState({ occasions: [] });
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Create Lunch and Dinner' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(availabilityState.occasionService.createOccasion).toHaveBeenCalledTimes(2),
    );
    expect(
      availabilityState.occasionService.createOccasion.mock.calls.map(([input]) => input.key),
    ).toEqual(['lunch', 'dinner']);
  });

  it('explains when a former route opens Availability on a section', async () => {
    navigationState.pathname = '/app/settings/restaurant/operating-hours';
    renderPage();

    expect(await screen.findByText('Operating hours is part of Availability.')).toBeInTheDocument();
    expect(screen.getByText('/app/settings/restaurant/operating-hours')).toBeInTheDocument();
  });

  it.each([
    ['service-periods', 'Service periods'],
    ['operating-hours', 'Operating hours'],
    ['occasions', 'Booking types'],
    ['turn-durations', 'Dining durations'],
  ])('opens Availability from the former %s route with a dismissible note', async (slug, title) => {
    const user = userEvent.setup();
    navigationState.pathname = `/app/settings/restaurant/${slug}`;
    renderPage();

    expect(await screen.findByText(`${title} is part of Availability.`)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText(`${title} is part of Availability.`)).not.toBeInTheDocument();
  });

  it('shows a retryable error when settings cannot load', async () => {
    availabilityState.operatingHoursQuery.data = null;
    availabilityState.operatingHoursQuery.error = new HttpError({
      message: 'x',
      status: 503,
      code: 'HTTP_503',
    });
    renderPage();

    expect(await screen.findByText('Availability settings couldn’t load')).toBeInTheDocument();
    expect(screen.getByText('HTTP_503')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('asks for a restaurant when none is selected', () => {
    renderPage(null);
    expect(screen.getByText('No restaurant selected')).toBeInTheDocument();
  });
});

describe('availability occasion model', () => {
  it('round-trips rule drafts and formats guest-facing summaries', () => {
    const drafts = toRuleDrafts([
      { kind: 'time_window', start: '12:00', end: '15:00' },
      { kind: 'month_only', months: [1, 12] },
      { kind: 'specific_dates', dates: ['2026-12-25'] },
    ]);

    const result = buildAvailabilityRules(drafts);

    expect(result).toEqual({
      valid: true,
      rules: [
        { kind: 'time_window', start: '12:00', end: '15:00' },
        { kind: 'month_only', months: [1, 12] },
        { kind: 'specific_dates', dates: ['2026-12-25'] },
      ],
    });
    expect(
      formatAvailabilitySummary([
        { kind: 'time_window', start: '12:00', end: '15:00' },
        { kind: 'month_only', months: [1, 12] },
      ]),
    ).toBe('12:00-15:00 · Months: Jan, Dec');
  });

  it('validates incomplete rule drafts and service-window keys', () => {
    const invalidWindow = { ...createRuleDraft('time_window'), start: '17:00', end: '16:00' };
    const emptyMonths = createRuleDraft('month_only');

    expect(buildAvailabilityRules([invalidWindow])).toEqual({
      valid: false,
      error: 'Time-window end times must be later than start times.',
    });
    expect(buildAvailabilityRules([emptyMonths])).toEqual({
      valid: false,
      error: 'Select at least one month for each month-based rule.',
    });
    expect(describeRuleDraft({ ...createRuleDraft('month_only'), months: [4, 5] })).toBe(
      'Available in Apr, May.',
    );
    expect(isServiceWindowOccasion('lunch')).toBe(true);
    expect(isServiceWindowOccasion('birthday')).toBe(false);
  });
});

describe('availability schedule manager model', () => {
  it('derives missing required service occasions from current occasion keys', () => {
    const keys = extractRequiredOccasionKeys([{ key: 'Lunch' }, { key: 'brunch' }]);

    expect(keys).toEqual({ lunch: 'Lunch' });
    expect(buildMissingRequiredOccasions(keys)).toEqual([
      expect.objectContaining({
        key: 'dinner',
        label: 'Dinner',
        defaultDurationMinutes: 120,
      }),
    ]);
    expect(buildMissingRequiredOccasions({ lunch: 'lunch', dinner: 'dinner' })).toEqual([]);
  });

  it('maps operating hours rows, validates booking controls, and builds payloads', () => {
    const snapshot = buildOperatingHours();
    const weeklyRows = mapWeeklyFromResponse(snapshot.weekly);
    const overrideRows = mapOverridesFromResponse([
      {
        id: 'override-1',
        effectiveDate: '2026-12-25',
        opensAt: '12:00:00',
        closesAt: '16:00:00',
        isClosed: false,
        notes: 'Christmas lunch',
        reservationIntervalMinutes: 30,
        reservationSlotTimes: ['12:00', '12:30', '12:00'],
      },
    ]);

    expect(weeklyRows[1]).toMatchObject({
      dayOfWeek: 1,
      opensAt: '12:00',
      closesAt: '22:00',
      reservationIntervalMinutes: '15',
    });
    expect(overrideRows[0]).toMatchObject({
      effectiveDate: '2026-12-25',
      opensAt: '12:00',
      closesAt: '16:00',
      reservationSlotTimes: '12:00, 12:30, 12:00',
    });
    expect(parseIntervalInput('7.5')).toEqual({
      value: null,
      error: 'Must be a whole number',
    });
    expect(parseSlotTimesInput('12:00, 12:30, 12:00')).toEqual({
      value: ['12:00', '12:30'],
    });
    expect(validateHours(weeklyRows, overrideRows).isValid).toBe(true);

    const payload = buildOperatingHoursPayload(weeklyRows, overrideRows);
    expect(payload.weekly[1]).toMatchObject({
      dayOfWeek: 1,
      opensAt: '12:00',
      closesAt: '22:00',
      reservationIntervalMinutes: 15,
    });
    expect(payload.overrides[0]).toMatchObject({
      id: 'override-1',
      reservationSlotTimes: ['12:00', '12:30'],
    });
  });

  it('creates stable UUIDs for new operating-hours override drafts', () => {
    const first = defaultOverrideRow();
    const second = defaultOverrideRow();

    expect(first.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(second.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(first.id).not.toBe(second.id);

    const payload = buildOperatingHoursPayload(
      mapWeeklyFromResponse(buildOperatingHours().weekly),
      [first],
    );
    expect(payload.overrides[0]?.id).toBe(first.id);
  });

  it('validates service window helpers and kitchen range labels', () => {
    const weeklyRows = mapWeeklyFromResponse(buildOperatingHours().weekly);
    const weeklyHours = buildWeeklyHoursMap(weeklyRows);
    const validation = validateServices([
      {
        dayOfWeek: 1,
        label: 'Monday',
        opensAt: weeklyHours[1].opensAt,
        closesAt: weeklyHours[1].closesAt,
        isClosed: false,
        lunch: {
          name: 'Lunch',
          enabled: true,
          startTime: '11:00',
          endTime: '15:00',
        },
        dinner: {
          name: 'Dinner',
          enabled: true,
          startTime: '17:00',
          endTime: '23:00',
        },
      },
    ]);

    expect(MEAL_LABELS).toEqual({ lunch: 'Lunch', dinner: 'Dinner' });
    expect(formatKitchenRange('12:00', '22:00')).toBe('12:00 – 22:00');
    expect(formatKitchenRange(null, '22:00')).toBe('Not set');
    expect(validation).toEqual({
      isValid: false,
      serviceErrors: {
        1: {
          lunch: { start: 'Before kitchen opens' },
          dinner: { end: 'After kitchen closes' },
        },
      },
    });
  });
});
