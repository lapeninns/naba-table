'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { fetchJson } from '@/lib/http/fetchJson';
import { queryKeys } from '@/lib/query/keys';

import type { OperatingHour, ServicePeriod, TableInventoryItem, Zone } from '../types';

/**
 * One mutation hook per onboarding step (contract C5). Every hook:
 * - reports errors inline (`meta.feedback.error: false`): the wizard renders
 *   `toUserMessage(error)` in its step alert, so there is no toast;
 * - shares the `onboarding` scope, so a double-click or a retry never runs two
 *   writes for the wizard at the same time;
 * - invalidates only the ops caches for the data it changed (they are normally
 *   empty for a new owner, so this is cheap);
 * - never navigates or changes wizard state; the step components do that.
 * Replace-style writes (hours, service periods, layout) are idempotent on the server,
 * so a retry cannot duplicate rows and no idempotency key is needed.
 */
const ONBOARDING_SCOPE = { id: 'onboarding' } as const;
const INLINE_ERRORS = { feedback: { error: false } } as const;

export type SignupStatus = 'ok' | 'confirmation_required' | 'magic_link_sent';

export type SignupVariables = {
  email: string;
  mode: 'password' | 'magic_link';
  password?: string;
};

export type SignupResult = {
  status: SignupStatus;
  redirectTo?: string;
};

export function useOnboardingSignup() {
  return useMutation({
    scope: ONBOARDING_SCOPE,
    meta: INLINE_ERRORS,
    mutationFn: (variables: SignupVariables) =>
      fetchJson<SignupResult>('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(variables),
      }),
  });
}

export type OnboardingProfileFields = {
  name: string;
  slug: string;
  timezone: string;
  contactEmail: string | null;
  contactPhone: string | null;
  bookingPolicy: string | null;
};

export type SaveProfileVariables = {
  /** Null creates the restaurant; an id updates the one this owner already created. */
  restaurantId: string | null;
  profile: OnboardingProfileFields;
};

export type SavedRestaurant = { id: string; name: string; slug: string; timezone: string };

export function useSaveOnboardingProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    scope: ONBOARDING_SCOPE,
    meta: INLINE_ERRORS,
    mutationFn: async ({ restaurantId, profile }: SaveProfileVariables) => {
      if (restaurantId) {
        // Back navigation after the restaurant exists: update it instead of re-creating it
        // (the create route refuses a second restaurant with 409).
        const response = await fetchJson<{ restaurant: SavedRestaurant }>(
          `/api/ops/restaurants/${encodeURIComponent(restaurantId)}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profile),
          },
        );
        return response.restaurant;
      }
      const response = await fetchJson<{ restaurant: SavedRestaurant }>(
        '/api/onboarding/restaurant',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(profile),
        },
      );
      return response.restaurant;
    },
    onSuccess: (restaurant, variables) => {
      if (variables.restaurantId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.opsRestaurants.detail(restaurant.id),
        });
      }
    },
  });
}

export type SaveHoursVariables = { restaurantId: string; operatingHours: OperatingHour[] };

export function useSaveOnboardingHours() {
  const queryClient = useQueryClient();
  return useMutation({
    scope: ONBOARDING_SCOPE,
    meta: INLINE_ERRORS,
    mutationFn: ({ restaurantId, operatingHours }: SaveHoursVariables) =>
      fetchJson<{ operatingHours: unknown }>(
        `/api/onboarding/restaurant/${encodeURIComponent(restaurantId)}/hours`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operatingHours }),
        },
      ),
    onSuccess: (_data, { restaurantId }) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.opsRestaurants.hours(restaurantId),
      });
    },
  });
}

export type SaveServicePeriodsVariables = {
  restaurantId: string;
  servicePeriods: ServicePeriod[];
};

export function useSaveOnboardingServicePeriods() {
  const queryClient = useQueryClient();
  return useMutation({
    scope: ONBOARDING_SCOPE,
    meta: INLINE_ERRORS,
    mutationFn: ({ restaurantId, servicePeriods }: SaveServicePeriodsVariables) =>
      fetchJson<{ servicePeriods: ServicePeriod[] }>(
        `/api/onboarding/restaurant/${encodeURIComponent(restaurantId)}/service-periods`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ servicePeriods }),
        },
      ),
    onSuccess: (_data, { restaurantId }) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.opsRestaurants.servicePeriods(restaurantId),
      });
    },
  });
}

export type LayoutTableInput = {
  tableNumber: string;
  capacity: number;
  zoneName?: string | null;
};

export type ReplaceLayoutVariables = {
  restaurantId: string;
  zones: Array<{ name: string; sortOrder?: number; active?: boolean }>;
  tables: LayoutTableInput[];
};

export type OnboardingLayoutResponse = {
  zones: Array<{ id: string; name: string; sortOrder: number; active: boolean }>;
  tables: Array<{
    id: string;
    tableNumber: string;
    capacity: number;
    zoneId: string;
  }>;
};

export function useReplaceOnboardingLayout() {
  const queryClient = useQueryClient();
  return useMutation({
    scope: ONBOARDING_SCOPE,
    meta: INLINE_ERRORS,
    mutationFn: async ({ restaurantId, zones, tables }: ReplaceLayoutVariables) => {
      const response = await fetchJson<{ data: OnboardingLayoutResponse }>(
        `/api/onboarding/restaurant/${encodeURIComponent(restaurantId)}/layout`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ zones, tables }),
        },
      );
      return response.data;
    },
    onSuccess: (_data, { restaurantId }) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.opsTables.restaurantPrefix(restaurantId),
      });
    },
  });
}

export type CompleteOnboardingResult = { status: 'ok'; ready: true; restaurantId: string };

export function useCompleteOnboarding() {
  return useMutation({
    scope: ONBOARDING_SCOPE,
    meta: INLINE_ERRORS,
    // Read-only readiness check on the server; safe to repeat.
    mutationFn: ({ restaurantId }: { restaurantId: string }) =>
      fetchJson<CompleteOnboardingResult>(
        `/api/onboarding/restaurant/${encodeURIComponent(restaurantId)}/complete`,
        { method: 'POST' },
      ),
  });
}

/** Maps the stored zones/tables draft to the layout payload. */
export function toLayoutVariables(
  restaurantId: string,
  zones: Zone[],
  tables: TableInventoryItem[],
): ReplaceLayoutVariables {
  return {
    restaurantId,
    zones: zones.map((zone, index) => ({
      name: zone.name.trim(),
      sortOrder: zone.sortOrder ?? index,
      active: zone.active ?? true,
    })),
    tables: tables.map((table) => ({
      tableNumber: table.tableNumber.trim(),
      capacity: Number(table.capacity),
      // Keep a table in the zone it was saved in; otherwise the server uses the first zone.
      zoneName: zones.find((zone) => zone.id && zone.id === table.zoneId)?.name.trim() ?? null,
    })),
  };
}
