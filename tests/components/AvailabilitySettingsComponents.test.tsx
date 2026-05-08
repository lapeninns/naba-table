import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const availabilityState = vi.hoisted(() => ({
  occasionService: {
    createOccasion: vi.fn(),
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
}));

vi.mock('@/contexts/ops-services', () => ({
  useOccasionService: () => availabilityState.occasionService,
}));

vi.mock('@/contexts/ops-unsaved-changes', () => ({
  useRegisterOpsUnsavedChanges: vi.fn(),
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

import {
  buildAvailabilityRules,
  createRuleDraft,
  describeRuleDraft,
  formatAvailabilitySummary,
  isServiceWindowOccasion,
  toRuleDrafts,
} from '@/components/features/restaurant-settings/availabilityOccasionsModel';
import { AvailabilityScheduleManager } from '@/components/features/restaurant-settings/AvailabilityScheduleManager';
import {
  buildOperatingHoursPayload,
  buildMissingRequiredOccasions,
  buildWeeklyHoursMap,
  extractRequiredOccasionKeys,
  formatKitchenRange,
  mapOverridesFromResponse,
  mapWeeklyFromResponse,
  MEAL_LABELS,
  parseIntervalInput,
  parseSlotTimesInput,
  validateHours,
  validateServices,
} from '@/components/features/restaurant-settings/availabilityScheduleManagerUtils';

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
  return {
    restaurantId: 'rest-1',
    bands: {},
    defaults: {},
  };
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
  availabilityState.operatingHoursQuery.isLoading = false;
  availabilityState.servicePeriodsQuery.data = buildServicePeriods();
  availabilityState.servicePeriodsQuery.error = null;
  availabilityState.servicePeriodsQuery.isLoading = false;
  availabilityState.occasionsQuery.data = occasions;
  availabilityState.occasionsQuery.error = null;
  availabilityState.occasionsQuery.isLoading = false;
  availabilityState.turnBandsQuery.data = buildTurnBands();
  availabilityState.turnBandsQuery.error = null;
  availabilityState.turnBandsQuery.isLoading = false;
}

function renderManager(restaurantId: string | null = 'rest-1') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AvailabilityScheduleManager restaurantId={restaurantId} />
    </QueryClientProvider>,
  );
}

describe('AvailabilityScheduleManager', () => {
  beforeEach(() => {
    availabilityState.occasionService.createOccasion.mockReset();
    availabilityState.occasionService.createOccasion.mockImplementation(async (input) =>
      buildOccasion({
        key: input.key,
        label: input.label,
        shortLabel: input.shortLabel,
        description: input.description,
        defaultDurationMinutes: input.defaultDurationMinutes,
        displayOrder: input.displayOrder,
        isActive: input.isActive,
      }),
    );
    availabilityState.updateOperatingHours.isPending = false;
    availabilityState.updateOperatingHours.mutateAsync.mockReset();
    availabilityState.updateServicePeriods.isPending = false;
    availabilityState.updateServicePeriods.mutateAsync.mockReset();
    availabilityState.updateTurnBands.isPending = false;
    availabilityState.updateTurnBands.mutateAsync.mockReset();
    setReadyAvailabilityState();
  });

  it('renders the no-restaurant state without loading editors', () => {
    renderManager(null);

    expect(screen.getByText('Weekly schedule')).toBeInTheDocument();
    expect(screen.getByText('Select a restaurant to manage availability.')).toBeInTheDocument();
    expect(screen.queryByText('Save configuration')).not.toBeInTheDocument();
  });

  it('renders a loading state while availability data initializes', () => {
    availabilityState.operatingHoursQuery.data = null;
    availabilityState.operatingHoursQuery.isLoading = true;

    renderManager();

    expect(screen.getByText('Operating hours and service windows together')).toBeInTheDocument();
    expect(screen.getByText('Loading the integrated availability editor.')).toBeInTheDocument();
  });

  it('renders a load error state with the failing message', () => {
    availabilityState.operatingHoursQuery.data = null;
    availabilityState.operatingHoursQuery.error = new Error('Hours request failed.');

    renderManager();

    expect(screen.getByText('Availability editor unavailable')).toBeInTheDocument();
    expect(screen.getByText('Hours request failed.')).toBeInTheDocument();
  });

  it('renders the ready schedule editor with save controls disabled until edits exist', async () => {
    renderManager();

    expect(await screen.findByText('How this command center works')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Weekly schedule' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Date overrides' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save configuration' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Save configuration' }).closest('.sticky'),
    ).toHaveClass('bottom-0');
    expect(screen.getByText(/Turn times per party size/i).parentElement).toHaveClass(
      'rounded-md',
      'bg-muted/20',
    );
    expect(
      screen.queryByText('Lunch and dinner booking types are required'),
    ).not.toBeInTheDocument();
  });

  it('creates missing lunch and dinner occasions and reports success', async () => {
    const user = userEvent.setup();
    setReadyAvailabilityState({ occasions: [] });

    renderManager();

    expect(
      await screen.findByText('Lunch and dinner booking types are required'),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Create missing lunch and dinner booking types' }),
    );

    await waitFor(() => {
      expect(availabilityState.occasionService.createOccasion).toHaveBeenCalledTimes(2);
    });
    expect(availabilityState.occasionService.createOccasion).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'lunch', label: 'Lunch' }),
    );
    expect(availabilityState.occasionService.createOccasion).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'dinner', label: 'Dinner' }),
    );
    expect(await screen.findByText('Required booking types created')).toBeInTheDocument();
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
