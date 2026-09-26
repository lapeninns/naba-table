/**
 * Availability page recovery with the real snapshot and save hooks (a stateful in-memory
 * AvailabilityService stands in for the route): a refused stale save, a Discard, and a snapshot
 * invalidated by something else (such as a Google import of hours) all end on the latest saved
 * settings and a save that can succeed.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const pageState = vi.hoisted(() => ({
  details: { data: null as unknown, error: null, isLoading: false, refetch: vi.fn() },
  occasions: { data: null as unknown, error: null, isLoading: false, refetch: vi.fn() },
}));

vi.mock('@/contexts/ops-services', () => ({
  useOccasionService: () => ({
    createOccasion: vi.fn(),
    updateOccasion: vi.fn(),
    deleteOccasion: vi.fn(),
  }),
}));

vi.mock('@/contexts/ops-unsaved-changes', () => ({
  useRegisterOpsUnsavedChanges: vi.fn(),
  useRegisterOptionalOpsUnsavedChanges: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/app/settings/restaurant/availability',
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/hooks/useGlobalShortcuts', () => ({ useGlobalShortcuts: vi.fn() }));

vi.mock('@/contexts/ops-session', () => ({
  useOpsSession: () => ({ permissions: { isPlatformAdmin: false } }),
}));

vi.mock('@/hooks/ops/useOccasions', () => ({
  useOpsOccasions: () => pageState.occasions,
}));

vi.mock('@/hooks/ops/useOpsRestaurantDetails', () => ({
  useOpsRestaurantDetails: () => pageState.details,
  useOpsUpdateRestaurantDetails: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

vi.mock('@/hooks/ops/useOpsDualSync', () => ({
  useOpsDualSync: () => ({
    stateQuery: { data: { fields: [] }, error: null, isError: false, isLoading: false },
  }),
}));

import { AvailabilitySettingsPage } from '@/components/features/restaurant-settings/availability/AvailabilitySettingsPage';
import { AvailabilityServiceProvider } from '@/contexts/availability-service';
import { HttpError } from '@/lib/http/errors';
import { queryKeys } from '@/lib/query/keys';

import type {
  AvailabilityCommandPayload,
  AvailabilityService,
  AvailabilitySnapshot,
} from '@/services/ops/availability';
import type { OpsOccasion } from '@/services/ops/occasions';
import type { RestaurantProfile } from '@/services/ops/restaurants';

const RESTAURANT_ID = 'rest-1';

function occasion(key: string, label: string, displayOrder: number): OpsOccasion {
  return {
    key,
    label,
    shortLabel: label,
    description: null,
    availability: [{ kind: 'anytime' }],
    defaultDurationMinutes: 90,
    displayOrder,
    isActive: true,
    isBuiltin: true,
    createdAt: null,
    updatedAt: null,
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
  };
}

const profile = {
  id: RESTAURANT_ID,
  name: 'Old Crown Girton',
  slug: 'old-crown-girton',
  timezone: 'Europe/London',
  contactEmail: 'ops@example.com',
  contactPhone: '+441223000000',
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
} as RestaurantProfile;

function initialSnapshot(): AvailabilitySnapshot {
  return {
    restaurantId: RESTAURANT_ID,
    revision: 'rev-1',
    hours: {
      updatedAt: '2026-09-01T12:00:00.000Z',
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
    },
    servicePeriods: Array.from({ length: 7 }).flatMap((_, dayOfWeek) => [
      {
        id: `lunch-${dayOfWeek}`,
        name: 'Lunch',
        dayOfWeek,
        startTime: '12:00',
        endTime: '15:00',
        bookingOption: 'lunch',
      },
      {
        id: `dinner-${dayOfWeek}`,
        name: 'Dinner',
        dayOfWeek,
        startTime: '17:00',
        endTime: '22:00',
        bookingOption: 'dinner',
      },
    ]),
    turnBands: { restaurantId: RESTAURANT_ID, bands: {}, defaults: {} },
    rules: {
      reservationIntervalMinutes: 15,
      reservationDefaultDurationMinutes: 90,
      reservationLastSeatingBufferMinutes: 15,
      reservationLifecycleGraceMinutes: 15,
      bookingPolicy: null,
      updatedAt: null,
    },
  };
}

/** The stored settings, with the route's stale-write contract. */
function createServer() {
  let snapshot = initialSnapshot();
  let revision = 1;
  const saves: AvailabilityCommandPayload[] = [];
  const bump = (next: AvailabilitySnapshot) => {
    revision += 1;
    snapshot = { ...next, revision: `rev-${revision}` };
  };
  const service: AvailabilityService = {
    getAvailability: async () => structuredClone(snapshot),
    saveAvailability: async (_restaurantId, payload) => {
      saves.push(payload);
      if (payload.expectedRevision && payload.expectedRevision !== snapshot.revision) {
        throw new HttpError({ status: 409, code: 'STALE_WRITE', message: 'Changed elsewhere.' });
      }
      bump({ ...snapshot, rules: { ...snapshot.rules, ...payload.rules } });
      return structuredClone(snapshot);
    },
  };
  /** Another writer (a manager in another tab, or a Google import) closes Monday at 23:00. */
  const changeMondayElsewhere = () => {
    bump({
      ...snapshot,
      hours: {
        ...snapshot.hours,
        weekly: snapshot.hours.weekly.map((row) =>
          row.dayOfWeek === 1 ? { ...row, closesAt: '23:00' } : row,
        ),
      },
    });
  };
  return { service, saves, changeMondayElsewhere, current: () => snapshot };
}

function renderPage(server: ReturnType<typeof createServer>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <AvailabilityServiceProvider service={server.service}>
        <AvailabilitySettingsPage restaurantId={RESTAURANT_ID} />
      </AvailabilityServiceProvider>
    </QueryClientProvider>,
  );
  return queryClient;
}

const mondayCloses = () => screen.getByLabelText('Closes', { selector: '#availability-w1-closes' });
const saveBar = () => screen.getByRole('region', { name: 'Unsaved changes' });

async function openMonday(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /^Monday/ }));
}

async function editBookingRule(user: ReturnType<typeof userEvent.setup>) {
  await openMonday(user);
  await user.click(
    await screen.findByLabelText('Increase last seating before closing by 15 minutes'),
  );
  expect(within(saveBar()).getByText('1 unsaved change')).toBeInTheDocument();
}

describe('AvailabilitySettingsPage recovery from newer saved settings', () => {
  beforeEach(() => {
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
    pageState.details.data = profile;
    pageState.occasions.data = [occasion('lunch', 'Lunch', 10), occasion('dinner', 'Dinner', 20)];
  });

  it('after STALE_WRITE loads the latest settings, keeps the edit, and the next save succeeds', async () => {
    const user = userEvent.setup();
    const server = createServer();
    renderPage(server);
    await editBookingRule(user);

    server.changeMondayElsewhere();
    await user.click(within(saveBar()).getByRole('button', { name: 'Save changes' }));

    // The refused save refetches the snapshot and the draft is rebased onto it.
    expect(await screen.findByTestId('availability-rebase-notice')).toHaveTextContent(
      'Someone else saved changes while you were editing',
    );
    await waitFor(() => expect(mondayCloses()).toHaveValue('23:00'));
    expect(within(saveBar()).getByText('1 unsaved change')).toBeInTheDocument();
    expect(within(saveBar()).queryByText(/not saved/)).not.toBeInTheDocument();

    await user.click(within(saveBar()).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(server.saves).toHaveLength(2));
    expect(server.saves[1]?.expectedRevision).toBe('rev-2');
    await waitFor(() => expect(server.current().revision).toBe('rev-3'));
    expect(server.current().rules.reservationLastSeatingBufferMinutes).toBe(30);
    // The rebase took the other writer's hours, so this save does not undo them.
    expect(server.current().hours.weekly.find((row) => row.dayOfWeek === 1)?.closesAt).toBe(
      '23:00',
    );
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Unsaved changes' })).not.toBeInTheDocument(),
    );
  });

  it('Discard restores the current saved settings, not the stale cached ones', async () => {
    const user = userEvent.setup();
    const server = createServer();
    renderPage(server);
    await editBookingRule(user);
    expect(mondayCloses()).toHaveValue('22:00');

    server.changeMondayElsewhere();
    await user.click(within(saveBar()).getByRole('button', { name: 'Discard' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Discard changes' }),
    );

    await waitFor(() => expect(mondayCloses()).toHaveValue('23:00'));
    expect(screen.queryByRole('region', { name: 'Unsaved changes' })).not.toBeInTheDocument();
  });

  it('re-seeds a clean page when the snapshot is invalidated elsewhere (e.g. a Google import)', async () => {
    const user = userEvent.setup();
    const server = createServer();
    const queryClient = renderPage(server);
    await openMonday(user);
    expect(mondayCloses()).toHaveValue('22:00');

    server.changeMondayElsewhere();
    await act(async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.opsRestaurants.availability(RESTAURANT_ID),
      });
    });

    await waitFor(() => expect(mondayCloses()).toHaveValue('23:00'));
    expect(screen.queryByTestId('availability-rebase-notice')).not.toBeInTheDocument();
  });

  it('rebases a dirty draft when the snapshot is invalidated elsewhere, so the next save is not stale', async () => {
    const user = userEvent.setup();
    const server = createServer();
    const queryClient = renderPage(server);
    await editBookingRule(user);

    server.changeMondayElsewhere();
    await act(async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.opsRestaurants.availability(RESTAURANT_ID),
      });
    });

    await waitFor(() => expect(mondayCloses()).toHaveValue('23:00'));
    expect(screen.getByTestId('availability-rebase-notice')).toHaveTextContent(
      'Loaded the latest Opening hours and special dates.',
    );
    expect(within(saveBar()).getByText('1 unsaved change')).toBeInTheDocument();

    await user.click(within(saveBar()).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(server.saves).toHaveLength(1));
    expect(server.saves[0]?.expectedRevision).toBe('rev-2');
    await waitFor(() => expect(server.current().revision).toBe('rev-3'));
  });
});

/**
 * The stored settings with per-section revisions (the current route): a save is refused only when
 * a section it writes changed since the page loaded.
 */
function createSectionServer() {
  const sections = ['hours', 'servicePeriods', 'turnBands', 'rules'] as const;
  let version = 1;
  let snapshot: AvailabilitySnapshot = {
    ...initialSnapshot(),
    revisions: {
      hours: 'hours-1',
      servicePeriods: 'servicePeriods-1',
      turnBands: 'turnBands-1',
      rules: 'rules-1',
    },
  };
  const saves: AvailabilityCommandPayload[] = [];
  const commit = (
    next: AvailabilitySnapshot,
    changed: ReadonlyArray<(typeof sections)[number]>,
  ) => {
    version += 1;
    const revisions = { ...snapshot.revisions! };
    for (const section of changed) revisions[section] = `${section}-${version}`;
    snapshot = { ...next, revision: `rev-${version}`, revisions };
  };
  const service: AvailabilityService = {
    getAvailability: async () => structuredClone(snapshot),
    saveAvailability: async (_restaurantId, payload) => {
      saves.push(payload);
      const written = sections.filter((section) => payload[section] !== undefined);
      const stale = payload.expectedRevisions
        ? written.some(
            (section) =>
              payload.expectedRevisions?.[section] !== undefined &&
              payload.expectedRevisions[section] !== snapshot.revisions![section],
          )
        : Boolean(payload.expectedRevision) && payload.expectedRevision !== snapshot.revision;
      if (stale) {
        throw new HttpError({ status: 409, code: 'STALE_WRITE', message: 'Changed elsewhere.' });
      }
      commit({ ...snapshot, rules: { ...snapshot.rules, ...payload.rules } }, written);
      return structuredClone(snapshot);
    },
  };
  const changeMondayElsewhere = () => {
    commit(
      {
        ...snapshot,
        hours: {
          ...snapshot.hours,
          weekly: snapshot.hours.weekly.map((row) =>
            row.dayOfWeek === 1 ? { ...row, closesAt: '23:00' } : row,
          ),
        },
      },
      ['hours'],
    );
  };
  return { service, saves, changeMondayElsewhere, current: () => snapshot };
}

describe('AvailabilitySettingsPage with per-section revisions', () => {
  beforeEach(() => {
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
    pageState.details.data = profile;
    pageState.occasions.data = [occasion('lunch', 'Lunch', 10), occasion('dinner', 'Dinner', 20)];
  });

  it('saves a booking-rule edit even though someone else saved the hours meanwhile', async () => {
    const user = userEvent.setup();
    const server = createSectionServer();
    const queryClient = renderPage(server as unknown as ReturnType<typeof createServer>);
    await editBookingRule(user);

    server.changeMondayElsewhere();
    await user.click(within(saveBar()).getByRole('button', { name: 'Save changes' }));

    // Only the written section is checked: no STALE_WRITE, one request.
    await waitFor(() =>
      expect(server.current().rules.reservationLastSeatingBufferMinutes).toBe(30),
    );
    expect(server.saves).toHaveLength(1);
    expect(server.saves[0]?.expectedRevisions).toEqual({ rules: 'rules-1' });
    expect(server.saves[0]).not.toHaveProperty('expectedRevision');
    expect(server.current().hours.weekly.find((row) => row.dayOfWeek === 1)?.closesAt).toBe(
      '23:00',
    );
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Unsaved changes' })).not.toBeInTheDocument(),
    );

    // The page then shows the other writer's hours, and a later hours save is checked against
    // their revision, not the one the page first loaded.
    await act(async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.opsRestaurants.availability(RESTAURANT_ID),
      });
    });
    await waitFor(() => expect(mondayCloses()).toHaveValue('23:00'));
    await user.clear(mondayCloses());
    await user.type(mondayCloses(), '22:30');
    await user.click(within(saveBar()).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(server.saves).toHaveLength(2));
    expect(Object.keys(server.saves[1]?.expectedRevisions ?? {})).toEqual(['hours']);
    expect(server.saves[1]?.expectedRevisions?.hours).toBe('hours-2');
    expect(server.saves[1]?.hours?.weekly.find((row) => row.dayOfWeek === 1)?.closesAt).toBe(
      '22:30',
    );
  });
});
