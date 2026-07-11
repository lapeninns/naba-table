/**
 * Shared fixtures for the dashboard component-test cluster
 * (MS-foundation-component-test-closure, Wave B).
 *
 * Not a test file: excluded from vitest's include glob and the QA tag audit
 * because it does not match *.test.* / *.spec.*.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import React from 'react';

import type { ManualAssignmentTable } from '@/services/ops/bookings';
import type {
  OpsTodayBooking,
  OpsTodayBookingsSummary,
  OpsTodayTotals,
} from '@/types/ops';
import type { FlattenedTable } from '@src/components/features/dashboard/booking-details/utils';

/** Deterministic reference instant: 2026-06-15T12:00:00Z (13:00 in Europe/London). */
export const PINNED_NOW_ISO = '2026-06-15T12:00:00.000Z';
export const PINNED_DATE_KEY = '2026-06-15';
export const PINNED_TIMEZONE = 'Europe/London';

export function makeBooking(overrides: Partial<OpsTodayBooking> = {}): OpsTodayBooking {
  return {
    id: 'booking-1',
    customerId: 'customer-1',
    status: 'confirmed',
    bookingType: null,
    startTime: '18:00',
    endTime: '19:30',
    partySize: 4,
    customerName: 'Alex Example',
    customerEmail: 'alex@example.com',
    customerPhone: '+44 7700 900123',
    notes: null,
    reference: 'REF-1234',
    details: null,
    source: 'web',
    profileNotes: null,
    allergies: null,
    dietaryRestrictions: null,
    seatingPreference: null,
    marketingOptIn: null,
    tableAssignments: [],
    requiresTableAssignment: true,
    checkedInAt: null,
    checkedOutAt: null,
    ...overrides,
  };
}

export function makeTotals(overrides: Partial<OpsTodayTotals> = {}): OpsTodayTotals {
  return {
    total: 0,
    confirmed: 0,
    completed: 0,
    pending: 0,
    cancelled: 0,
    noShow: 0,
    upcoming: 0,
    covers: 0,
    ...overrides,
  };
}

export function makeSummary(
  overrides: Partial<OpsTodayBookingsSummary> = {},
): OpsTodayBookingsSummary {
  const date = overrides.date ?? PINNED_DATE_KEY;
  const timezone = overrides.timezone ?? PINNED_TIMEZONE;
  const restaurantId = overrides.restaurantId ?? 'restaurant-1';
  return {
    meta: { date, timezone, restaurantId },
    date,
    timezone,
    restaurantId,
    totals: makeTotals(overrides.totals),
    bookings: [],
    ...overrides,
  };
}

export function makeManualTable(
  overrides: Partial<ManualAssignmentTable> = {},
): ManualAssignmentTable {
  return {
    id: 'table-1',
    tableNumber: 'T1',
    name: null,
    capacity: 4,
    minPartySize: 1,
    maxPartySize: 6,
    section: 'Main',
    category: 'standard',
    seatingType: 'standard',
    mobility: 'movable',
    zoneId: 'zone-1',
    zoneActive: true,
    status: 'available',
    active: true,
    position: null,
    ...overrides,
  };
}

export function makeFlattenedTable(overrides: Partial<FlattenedTable> = {}): FlattenedTable {
  return {
    id: 'table-1',
    tableNumber: 'T1',
    capacity: 4,
    section: 'Main',
    ...overrides,
  };
}

/**
 * KNOWN-ISSUE (test-infra) helper.
 *
 * Several dashboard sources import src-only hooks through the `@/` alias
 * (e.g. `@/hooks/use-minimum-delay`, `@/hooks/ops/useOpsTodaySummary`).
 * Next resolves those via the tsconfig `@/*` fallback (root, then src/), but
 * vitest.config.ts maps `@` to the repo root only, so the specifiers are
 * unresolvable here and the module fails at transform time. vitest.config.ts
 * is outside this spec's blast radius (tests/components/** only), so the
 * affected suites attempt the import and run either the behavioral branch
 * (module loads — i.e. once a per-file alias like the existing
 * `'@/hooks/use-copy-to-clipboard'` entries is added to vitest.config.ts) or
 * a pinned KNOWN-ISSUE branch documenting the blocker.
 */
export async function attemptImport<T>(spec: string): Promise<{ mod: T | null; error: unknown }> {
  try {
    return { mod: (await import(spec)) as T, error: null };
  } catch (error) {
    return { mod: null, error };
  }
}

/**
 * tests/setup.ts registers window.matchMedia as a vi.fn(), but the root config
 * runs with `mockReset: true`, which wipes that implementation before every
 * test — matchMedia() then returns undefined and libraries that consume the
 * MediaQueryList (framer-motion's useReducedMotion, Radix media hooks) crash.
 * Install a plain-function (reset-immune) matchMedia before rendering such
 * components. Call it at module scope or in beforeAll.
 */
export function installStableMatchMedia(matches = false) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

export function renderWithQueryClient(ui: React.ReactElement, queryClient?: QueryClient) {
  const client = queryClient ?? createTestQueryClient();
  return {
    queryClient: client,
    ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>),
  };
}
