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
    listOccasions: vi.fn(),
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
  saveAvailability: {
    isPending: false,
    mutateAsync: vi.fn(),
  },
  /** Revision of the availability snapshot the page loads (rows and revision come together). */
  revisionQuery: { data: 'rev-1' as string | undefined, error: null as Error | null },
  /** When set, the snapshot query returns exactly this (independent of the per-part fixtures). */
  snapshotQueryOverride: null as null | { data: unknown; error: null; isLoading: false },
  isPlatformAdmin: false,
  gbpFields: [] as unknown[],
}));

vi.mock('@/contexts/ops-session', () => ({
  useOpsSession: () => ({ permissions: { isPlatformAdmin: availabilityState.isPlatformAdmin } }),
}));

/**
 * The page reads hours, meal times, table times and rules from ONE snapshot query. It is composed
 * here from the per-part fixtures, memoised on their identities so a render sees stable data.
 */
const snapshotQueryCache = vi.hoisted(() => ({
  inputs: [] as unknown[],
  result: null as unknown,
}));

vi.mock('@src/hooks/ops/useOpsSaveAvailability', () => ({
  useOpsAvailability: () => {
    const state = availabilityState;
    if (state.snapshotQueryOverride) {
      return state.snapshotQueryOverride;
    }
    const inputs = [
      state.operatingHoursQuery.data,
      state.operatingHoursQuery.error,
      state.servicePeriodsQuery.data,
      state.servicePeriodsQuery.error,
      state.turnBandsQuery.data,
      state.turnBandsQuery.error,
      state.detailsQuery.data,
      state.revisionQuery.data,
      state.revisionQuery.error,
    ];
    if (
      snapshotQueryCache.result &&
      inputs.length === snapshotQueryCache.inputs.length &&
      inputs.every((value, index) => Object.is(value, snapshotQueryCache.inputs[index]))
    ) {
      return snapshotQueryCache.result;
    }
    const details = state.detailsQuery.data;
    const ready =
      state.operatingHoursQuery.data &&
      state.servicePeriodsQuery.data &&
      state.turnBandsQuery.data &&
      state.revisionQuery.data;
    const result = {
      data: ready
        ? {
            restaurantId: 'rest-1',
            revision: state.revisionQuery.data,
            hours: state.operatingHoursQuery.data,
            servicePeriods: state.servicePeriodsQuery.data,
            turnBands: state.turnBandsQuery.data,
            rules: {
              reservationIntervalMinutes: details.reservationIntervalMinutes,
              reservationDefaultDurationMinutes: details.reservationDefaultDurationMinutes,
              reservationLastSeatingBufferMinutes: details.reservationLastSeatingBufferMinutes,
              reservationLifecycleGraceMinutes: details.reservationLifecycleGraceMinutes,
              bookingPolicy: details.bookingPolicy,
              updatedAt: details.updatedAt,
            },
          }
        : undefined,
      error:
        state.operatingHoursQuery.error ??
        state.servicePeriodsQuery.error ??
        state.turnBandsQuery.error ??
        state.revisionQuery.error,
      isLoading: false,
      refetch: vi.fn(),
    };
    snapshotQueryCache.inputs = inputs;
    snapshotQueryCache.result = result;
    return result;
  },
  useOpsSaveAvailability: () => availabilityState.saveAvailability,
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

import type { AvailabilityCommandPayload, AvailabilitySnapshot } from '@/services/ops/availability';
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

/** What the availability command answers: the canonical state after the save. */
function buildSaveResult(payload: AvailabilityCommandPayload): AvailabilitySnapshot {
  const details = availabilityState.detailsQuery.data;
  return {
    restaurantId: 'rest-1',
    revision: 'rev-2',
    hours: { ...buildOperatingHours(), ...(payload.hours ?? {}) },
    servicePeriods: payload.servicePeriods ?? buildServicePeriods(),
    turnBands: { ...buildTurnBands(), bands: payload.turnBands ?? {} },
    rules: {
      reservationIntervalMinutes: details.reservationIntervalMinutes,
      reservationDefaultDurationMinutes: details.reservationDefaultDurationMinutes,
      reservationLastSeatingBufferMinutes: details.reservationLastSeatingBufferMinutes,
      reservationLifecycleGraceMinutes: details.reservationLifecycleGraceMinutes,
      bookingPolicy: details.bookingPolicy,
      ...payload.rules,
      updatedAt: '2026-09-27T10:00:00.000Z',
    },
  };
}

/** Every write the page sent: occasion catalog calls and availability commands, in order. */
function recordedWrites(): string[] {
  const calls: Array<{ order: number; label: string }> = [];
  const push = (mock: { mock: { invocationCallOrder: number[] } }, label: string) =>
    mock.mock.invocationCallOrder.forEach((order) => calls.push({ order, label }));
  push(availabilityState.occasionService.createOccasion, 'occasion:create');
  push(availabilityState.occasionService.updateOccasion, 'occasion:update');
  push(availabilityState.occasionService.deleteOccasion, 'occasion:delete');
  push(availabilityState.saveAvailability.mutateAsync, 'availability:command');
  push(availabilityState.updateOperatingHours.mutateAsync, 'legacy:hours');
  push(availabilityState.updateServicePeriods.mutateAsync, 'legacy:service-periods');
  push(availabilityState.updateTurnBands.mutateAsync, 'legacy:turn-bands');
  push(availabilityState.updateDetails.mutateAsync, 'legacy:restaurant-patch');
  return calls.sort((a, b) => a.order - b.order).map((call) => call.label);
}

function lastCommand(): AvailabilityCommandPayload {
  const calls = availabilityState.saveAvailability.mutateAsync.mock.calls;
  return calls[calls.length - 1]![0] as AvailabilityCommandPayload;
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
    // The save re-reads the catalog before writing; the page's own list query is mocked above.
    availabilityState.occasionService.listOccasions.mockImplementation(
      async () => availabilityState.occasionsQuery.data,
    );
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
    availabilityState.isPlatformAdmin = false;
    availabilityState.revisionQuery = { data: 'rev-1', error: null };
    availabilityState.snapshotQueryOverride = null;
    availabilityState.saveAvailability.mutateAsync.mockReset();
    availabilityState.saveAvailability.mutateAsync.mockImplementation(
      async (payload: AvailabilityCommandPayload) => buildSaveResult(payload),
    );
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
    expect(recordedWrites()).toEqual([]);
  });

  it('saves narrowed hours and meal times in one command, with weekly and special dates together', async () => {
    const user = userEvent.setup();
    renderPage();
    await openMonday(user);

    const closes = screen.getByLabelText('Closes', { selector: '#availability-w1-closes' });
    await user.clear(closes);
    await user.type(closes, '21:00');
    const dinnerEnd = screen.getAllByLabelText('Meal time ends')[1]!;
    await user.clear(dinnerEnd);
    await user.type(dinnerEnd, '21:00');

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(recordedWrites()).toEqual(['availability:command']));
    const command = lastCommand();
    expect(command.expectedRevision).toBe('rev-1');
    expect(command.hours!.weekly.find((row) => row.dayOfWeek === 1)?.closesAt).toBe('21:00');
    expect(command.hours!.overrides).toEqual([]);
    expect(command.servicePeriods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dayOfWeek: 1, bookingOption: 'dinner', endTime: '21:00' }),
      ]),
    );
    expect(command).not.toHaveProperty('rules');
    expect(command).not.toHaveProperty('turnBands');
    expect(await screen.findByText('All changes saved')).toBeInTheDocument();
  });

  it('reports a failed save with the reason code and keeps the edits', async () => {
    const user = userEvent.setup();
    availabilityState.saveAvailability.mutateAsync.mockRejectedValue(
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

    // One transaction: hours and rules fail together, nothing is half-saved.
    expect(
      await screen.findByText(
        'Opening hours and special dates and Booking rules not saved. Your edits are still here.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('HTTP_500', { selector: '.font-mono' })).toBeInTheDocument();
    expect(screen.getByText('Not all changes saved')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(recordedWrites()).toEqual(['availability:command']);
  });

  it('@contract builds the draft and the precondition from the same snapshot, never from older caches', async () => {
    const user = userEvent.setup();
    // The single-resource caches say Monday closes 22:00 (e.g. restored from a warm cache); the
    // snapshot, read together with its revision, says 23:00.
    const hours = buildOperatingHours();
    hours.weekly = hours.weekly.map((row) =>
      row.dayOfWeek === 1 ? { ...row, closesAt: '23:00' } : row,
    );
    const snapshot = {
      ...buildSaveResult({}),
      revision: 'rev-7',
      hours,
    };
    availabilityState.snapshotQueryOverride = { data: snapshot, error: null, isLoading: false };
    renderPage();
    await openMonday(user);

    expect(screen.getByLabelText('Closes', { selector: '#availability-w1-closes' })).toHaveValue(
      '23:00',
    );
    await user.click(screen.getByLabelText('Increase last seating before closing by 15 minutes'));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(recordedWrites()).toEqual(['availability:command']));
    expect(lastCommand().expectedRevision).toBe('rev-7');
  });

  it('@contract rebases a dirty draft onto a newer snapshot, says so, and saves against its revision', async () => {
    const user = userEvent.setup();
    const loaded = { ...buildSaveResult({}), revision: 'rev-7' };
    availabilityState.snapshotQueryOverride = { data: loaded, error: null, isLoading: false };
    const view = renderPage();

    await user.click(
      await screen.findByLabelText('Increase last seating before closing by 15 minutes'),
    );
    // Someone else saves; the snapshot refetch brings their rows and revision.
    availabilityState.snapshotQueryOverride = {
      data: { ...buildSaveResult({}), revision: 'rev-8' },
      error: null,
      isLoading: false,
    };
    view.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <AvailabilitySettingsPage restaurantId="rest-1" />
      </QueryClientProvider>,
    );
    // The edit is kept on top of the newer settings, and staff are told they changed.
    expect(await screen.findByTestId('availability-rebase-notice')).toHaveTextContent(
      'Someone else saved changes while you were editing',
    );
    expect(
      within(screen.getByRole('region', { name: 'Unsaved changes' })).getByText('1 unsaved change'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(recordedWrites()).toEqual(['availability:command']));
    expect(lastCommand().expectedRevision).toBe('rev-8');
  });

  it('explains a stale save instead of overwriting newer settings', async () => {
    const user = userEvent.setup();
    availabilityState.saveAvailability.mutateAsync.mockRejectedValue(
      new HttpError({ message: 'Changed', status: 409, code: 'STALE_WRITE' }),
    );
    renderPage();

    await user.click(
      await screen.findByLabelText('Increase last seating before closing by 15 minutes'),
    );
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText(/Someone else changed these settings\./)).toBeInTheDocument();
    expect(
      screen.getByText(/Your edits are still here\. Reload the latest settings, review them/),
    ).toBeInTheDocument();
    expect(screen.getByText('CONFLICT', { selector: '.font-mono' })).toBeInTheDocument();
    // Saving again with the same old revision can only be refused, so it is not offered.
    const bar = screen.getByRole('region', { name: 'Unsaved changes' });
    expect(within(bar).queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
    expect(within(bar).getByRole('button', { name: 'Reload latest' })).toBeInTheDocument();
  });

  it('saves booking rules through the availability command, not a restaurant PATCH', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByLabelText('Increase last seating before closing by 15 minutes'),
    );
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(recordedWrites()).toEqual(['availability:command']));
    expect(lastCommand()).toEqual({
      expectedRevision: 'rev-1',
      rules: {
        bookingPolicy: null,
        reservationIntervalMinutes: 15,
        reservationLastSeatingBufferMinutes: 30,
        reservationLifecycleGraceMinutes: 15,
      },
    });
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

    await waitFor(() => expect(recordedWrites()).toEqual(['availability:command']));
    expect(lastCommand()).toEqual({
      expectedRevision: 'rev-1',
      rules: { reservationDefaultDurationMinutes: 105 },
    });
    await waitFor(() => expect(screen.getByText('All changes saved')).toBeInTheDocument());
  });

  it('reports a failed default table time save without claiming the section saved', async () => {
    const user = userEvent.setup();
    availabilityState.saveAvailability.mutateAsync.mockRejectedValue(
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
    expect(recordedWrites()).toEqual(['availability:command']);
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

  it('adds Lunch and Dinner to the draft and creates them on save (platform admins)', async () => {
    const user = userEvent.setup();
    availabilityState.isPlatformAdmin = true;
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
    // Only the catalog changed, so no restaurant command is sent.
    expect(recordedWrites()).toEqual(['occasion:create', 'occasion:create']);
  });

  it('@security lets staff who are not platform admins ask Nabatable instead of creating types', async () => {
    setReadyAvailabilityState({ occasions: [] });
    renderPage();

    expect(
      await screen.findByText(/Booking types are managed by Nabatable: contact Nabatable/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Create Lunch and Dinner' }),
    ).not.toBeInTheDocument();
  });

  it('@security saves hours and table times for a restaurant admin with no booking-type request', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByTestId('booking-types-managed-note')).toHaveTextContent(
      'Booking types are managed by Nabatable.',
    );
    expect(screen.queryByRole('button', { name: 'Add booking type' })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: /available to book/ })).not.toBeInTheDocument();

    await openMonday(user);
    const closes = screen.getByLabelText('Closes', { selector: '#availability-w1-closes' });
    await user.clear(closes);
    await user.type(closes, '23:00');

    await user.click(screen.getByRole('button', { name: 'Edit table times for Lunch' }));
    const dialog = await screen.findByRole('dialog', { name: 'Table times for Lunch' });
    await user.click(within(dialog).getByRole('button', { name: /Add band/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Update table times' }));

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(screen.getByText('All changes saved')).toBeInTheDocument());
    // Exactly one request: the restaurant command. No occasion reads or writes at all.
    expect(recordedWrites()).toEqual(['availability:command']);
    expect(availabilityState.occasionService.listOccasions).not.toHaveBeenCalled();
    const command = lastCommand();
    expect(command.hours).toBeDefined();
    expect(command.turnBands).toHaveProperty('lunch');
  });

  it('writes booking types first, then one command, for platform admins', async () => {
    const user = userEvent.setup();
    availabilityState.isPlatformAdmin = true;
    availabilityState.occasionService.updateOccasion.mockImplementation(async (key, input) =>
      buildOccasion({ key, ...input }),
    );
    renderPage();

    await user.click(await screen.findByRole('switch', { name: 'Dinner available to book' }));
    await user.click(screen.getByLabelText('Increase last seating before closing by 15 minutes'));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(recordedWrites()).toEqual(['occasion:update', 'availability:command']),
    );
    expect(availabilityState.occasionService.updateOccasion).toHaveBeenCalledWith(
      'dinner',
      expect.objectContaining({ isActive: false }),
    );
    expect(lastCommand()).not.toHaveProperty('turnBands');
  });

  it('explains an occasion conflict accurately instead of blaming another editor', async () => {
    const user = userEvent.setup();
    availabilityState.isPlatformAdmin = true;
    availabilityState.occasionService.updateOccasion.mockRejectedValue(
      new HttpError({ message: 'x', status: 403, code: 'PLATFORM_ADMIN_REQUIRED' }),
    );
    renderPage();

    await user.click(await screen.findByRole('switch', { name: 'Dinner available to book' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    const alert = await screen.findByTestId('availability-save-failure');
    expect(alert).toHaveTextContent('Booking types not saved');
    expect(alert).toHaveTextContent('Only Nabatable can add, change or remove them.');
    expect(screen.queryByText(/Someone else changed these settings/)).not.toBeInTheDocument();
    expect(recordedWrites()).toEqual(['occasion:update']);
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
