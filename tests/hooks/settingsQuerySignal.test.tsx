import { QueryClientProvider, type QueryClient, type QueryKey } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useTableInventoryDataState } from '@/components/features/tables/useTableInventoryDataState';
import { OpsServicesProvider } from '@/contexts/ops-services';
import { fetchJson } from '@/lib/http/fetchJson';
import { createAppQueryClient } from '@/lib/query/client';
import { queryKeys } from '@/lib/query/keys';
import ZoneService from '@/services/ops/zones';
import { dualSyncQueryKeys, gbpOperatorQueryKeys } from '@src/hooks/ops/opsIntegrationQueries';
import { useOpsOccasions } from '@src/hooks/ops/useOccasions';
import { useOpsDualSync } from '@src/hooks/ops/useOpsDualSync';
import {
  useOpsGbpOperatorState,
  useOpsGoogleBusinessProfileAvailableLocations,
  useOpsGoogleBusinessProfileConnection,
} from '@src/hooks/ops/useOpsGoogleBusinessProfile';
import { useOpsMenuHierarchy } from '@src/hooks/ops/useOpsMenuHierarchy';
import { useOpsOperatingHours } from '@src/hooks/ops/useOpsOperatingHours';
import { useOpsRestaurantBusinessContext } from '@src/hooks/ops/useOpsRestaurantBusinessContext';
import { useOpsRestaurantDetails } from '@src/hooks/ops/useOpsRestaurantDetails';
import { useOpsRestaurantEmailTemplates } from '@src/hooks/ops/useOpsRestaurantEmailTemplates';
import { useOpsServicePeriods } from '@src/hooks/ops/useOpsServicePeriods';
import { useOpsTeamInvitations } from '@src/hooks/ops/useOpsTeamInvitations';
import { useOpsTurnBands } from '@src/hooks/ops/useOpsTurnBands';

import type { ReactNode } from 'react';

vi.mock('@/lib/http/fetchJson', () => ({ fetchJson: vi.fn() }));

const fetchJsonMock = vi.mocked(fetchJson);
const restaurantId = 'rest-1';

type PendingRequest = { url: string; signal: AbortSignal | null | undefined };

// Every request stays in flight until its signal aborts, like a slow real fetch.
let pending: PendingRequest[] = [];

function hangUntilAborted(input: RequestInfo | URL, init?: RequestInit): Promise<never> {
  const signal = init?.signal;
  pending.push({ url: String(input), signal });
  return new Promise<never>((_resolve, reject) => {
    signal?.addEventListener('abort', () => reject(signal.reason));
  });
}

function renderWithClient<T>(hook: () => T) {
  // The real app client; retries are irrelevant because every request is aborted.
  const queryClient: QueryClient = createAppQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <OpsServicesProvider>{children}</OpsServicesProvider>
    </QueryClientProvider>
  );
  renderHook(hook, { wrapper });
  return queryClient;
}

async function expectCancelAbortsFetch(queryKey: QueryKey, url: RegExp, hook: () => unknown) {
  const queryClient = renderWithClient(hook);

  await waitFor(() => expect(pending.some((request) => url.test(request.url))).toBe(true));
  const request = pending.find((entry) => url.test(entry.url));
  expect(request?.signal).toBeInstanceOf(AbortSignal);
  expect(request?.signal?.aborted).toBe(false);

  await queryClient.cancelQueries({ queryKey });

  expect(request?.signal?.aborted).toBe(true);
}

describe('restaurant settings queries pass the query AbortSignal to fetchJson', () => {
  beforeEach(() => {
    pending = [];
    fetchJsonMock.mockReset();
    fetchJsonMock.mockImplementation(hangUntilAborted);
  });

  it('business context', async () => {
    await expectCancelAbortsFetch(
      queryKeys.opsRestaurants.businessContext(restaurantId),
      /\/business-context$/,
      () => useOpsRestaurantBusinessContext(restaurantId),
    );
  });

  it('restaurant details', async () => {
    await expectCancelAbortsFetch(
      queryKeys.opsRestaurants.detail(restaurantId),
      /^\/api\/ops\/restaurants\/rest-1$/,
      () => useOpsRestaurantDetails(restaurantId),
    );
  });

  it('operating hours', async () => {
    await expectCancelAbortsFetch(queryKeys.opsRestaurants.hours(restaurantId), /\/hours$/, () =>
      useOpsOperatingHours(restaurantId),
    );
  });

  it('service periods', async () => {
    await expectCancelAbortsFetch(
      queryKeys.opsRestaurants.servicePeriods(restaurantId),
      /\/service-periods$/,
      () => useOpsServicePeriods(restaurantId),
    );
  });

  it('turn bands', async () => {
    await expectCancelAbortsFetch(
      queryKeys.opsRestaurants.turnBands(restaurantId),
      /\/turn-bands$/,
      () => useOpsTurnBands(restaurantId),
    );
  });

  it('email templates', async () => {
    await expectCancelAbortsFetch(
      queryKeys.opsRestaurants.emailTemplates(restaurantId),
      /\/email-templates$/,
      () => useOpsRestaurantEmailTemplates(restaurantId),
    );
  });

  it('occasions', async () => {
    await expectCancelAbortsFetch(queryKeys.opsOccasions.list(), /^\/api\/ops\/occasions$/, () =>
      useOpsOccasions(),
    );
  });

  it('menu hierarchy', async () => {
    await expectCancelAbortsFetch(queryKeys.opsMenuHierarchy.list(restaurantId), /\/menus$/, () =>
      useOpsMenuHierarchy(restaurantId),
    );
  });

  it('team invitations', async () => {
    await expectCancelAbortsFetch(
      queryKeys.team.invitations(restaurantId, 'pending'),
      /^\/api\/ops\/team\/invitations\?/,
      () => useOpsTeamInvitations({ restaurantId }),
    );
  });

  it('Google Business Profile connection', async () => {
    await expectCancelAbortsFetch(
      queryKeys.opsRestaurants.googleBusinessProfile(restaurantId),
      /\/google-business-profile\/details$/,
      () => useOpsGoogleBusinessProfileConnection(restaurantId),
    );
  });

  it('Google Business Profile locations', async () => {
    await expectCancelAbortsFetch(
      queryKeys.opsRestaurants.googleBusinessProfileLocations(restaurantId),
      /\/google-business-profile\/locations$/,
      () => useOpsGoogleBusinessProfileAvailableLocations(restaurantId),
    );
  });

  it('Google Business Profile operator connection state', async () => {
    await expectCancelAbortsFetch(
      gbpOperatorQueryKeys.connection(restaurantId),
      /\/restaurants\/rest-1\/google-business-profile$/,
      () => useOpsGbpOperatorState(restaurantId),
    );
  });

  it('dual-sync state', async () => {
    await expectCancelAbortsFetch(
      dualSyncQueryKeys.state(restaurantId),
      /\/dual-sync\/state$/,
      () => useOpsDualSync({ restaurantId }),
    );
  });

  it('tables list', async () => {
    await expectCancelAbortsFetch(
      queryKeys.opsTables.list(restaurantId),
      /^\/api\/ops\/tables\?/,
      () => useTableInventoryDataState(restaurantId),
    );
  });

  it('zone service forwards the signal to fetchJson', async () => {
    const controller = new AbortController();
    const request = new ZoneService().list(restaurantId, { signal: controller.signal });

    expect(fetchJsonMock.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
    controller.abort();
    await expect(request).rejects.toBeDefined();
  });
});
