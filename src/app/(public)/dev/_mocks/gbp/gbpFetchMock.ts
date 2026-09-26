'use client';

import {
  gbpConnectionFor,
  gbpDualSyncStateFor,
  gbpExactPreview,
  gbpOperatorStateFor,
  gbpPublishResponse,
  GBP_LOCATIONS,
  GBP_TERMINAL_NOTICES,
  type GbpOperatorStateFixture,
  type GbpScenario,
} from './gbpFixtures';
import { DEV_RESTAURANT_ID } from '../devIds';

type MockResponse = { status?: number; body: unknown } | null;

const BASE = `/api/ops/restaurants/${DEV_RESTAURANT_ID}`;

function json({ status = 200, body }: { status?: number; body: unknown }) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function readBody(init?: RequestInit): Promise<Record<string, unknown>> {
  if (typeof init?.body !== 'string') return {};
  try {
    return JSON.parse(init.body) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Serves the Google Business Profile and dual-sync endpoints from scenario fixtures, so the dev
 * harness runs the page's real clients and hooks. Everything else passes through to the network.
 * Keeps just enough state for the page's own actions (pause, writes, disconnect, link, publish).
 */
export function installGbpFetchMock(scenario: GbpScenario): () => void {
  const original = window.fetch.bind(window);
  let connection = gbpConnectionFor(scenario);
  let operator: GbpOperatorStateFixture | null =
    scenario === 'opsdown' ? null : gbpOperatorStateFor(scenario);
  let state = gbpDualSyncStateFor(scenario);
  let notifications = { enabled: true, refCount: 2 };
  let lastPreviewGroupIds: string[] = [];

  const route = async (path: string, method: string, init?: RequestInit): Promise<MockResponse> => {
    const body = await readBody(init);
    switch (`${method} ${path.replace(BASE, '')}`) {
      case 'GET /google-business-profile/details':
        return { body: connection };
      case 'GET /google-business-profile/locations':
        return { body: { locations: GBP_LOCATIONS } };
      case 'POST /google-business-profile/connect':
        return { body: { authorizationUrl: '/dev/ops-gbp?scenario=authorized' } };
      case 'PUT /google-business-profile':
        connection = gbpConnectionFor('linked');
        operator = gbpOperatorStateFor('linked');
        return { body: connection };
      case 'DELETE /google-business-profile':
        if (!body.password) return { status: 400, body: { error: 'Password required' } };
        connection = gbpConnectionFor('unlinked');
        return { body: connection };
      case 'GET /google-business-profile':
        return operator
          ? { body: operator }
          : { status: 503, body: { error: 'Write controls unavailable' } };
      case 'PUT /google-business-profile/write-access':
        if (!operator) return { status: 503, body: { error: 'Unavailable' } };
        operator = {
          ...operator,
          writeState: body.eligible ? 'eligible' : 'blocked',
          reasonCode: body.eligible ? null : 'writes_turned_off',
        };
        return { body: operator };
      case 'GET /google-business-profile/notifications':
        return { body: GBP_TERMINAL_NOTICES };
      case 'PUT /google-business-profile/notifications':
        notifications = { enabled: Boolean(body.enabled), refCount: body.enabled ? 2 : 1 };
        if (operator) operator = { ...operator, notifications };
        return { body: notifications };
      case 'GET /dual-sync/state':
        return { body: state };
      case 'POST /dual-sync/refresh':
        if (operator?.pendingUpdates.state === 'unknown') {
          operator = gbpOperatorStateFor('linked');
        }
        return {
          body: {
            snapshotRun: state.lastSnapshot,
            foodMenusRefresh: { status: 'unchanged' },
            transitions: [],
            evaluatedFieldKeys: [],
          },
        };
      case 'PATCH /dual-sync/control':
        state = {
          ...state,
          control: {
            ...state.control,
            syncPaused: Boolean(body.syncPaused),
            pauseReason: typeof body.reason === 'string' ? body.reason : null,
          },
        };
        return { body: { restaurantId: DEV_RESTAURANT_ID, control: state.control } };
      case 'POST /dual-sync/publish/preview': {
        const decisions = Array.isArray(body.decisions) ? body.decisions : [];
        const keys = decisions
          .filter((decision): decision is { fieldKey: string; action: string } =>
            Boolean(decision && typeof decision === 'object' && 'fieldKey' in decision),
          )
          .filter((decision) => decision.action === 'export_to_google')
          .map((decision) => decision.fieldKey);
        const preview = gbpExactPreview(keys);
        lastPreviewGroupIds = preview.groups.map((group) => group.groupId);
        return { body: preview };
      }
      case 'POST /dual-sync/publish':
        return { body: gbpPublishResponse(lastPreviewGroupIds) };
      default:
        if (path.startsWith(`${BASE}/dual-sync/`)) {
          return { body: { items: [], jobs: [], candidates: [], operations: [] } };
        }
        return null;
    }
  };

  window.fetch = async (input, init) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
      window.location.origin,
    );
    if (url.pathname.startsWith(BASE)) {
      const method = (init?.method ?? 'GET').toUpperCase();
      const response = await route(url.pathname, method, init);
      if (response) {
        // A short delay so loading and pending states are visible.
        await new Promise((resolve) => window.setTimeout(resolve, 250));
        return json(response);
      }
    }
    return original(input, init);
  };

  return () => {
    window.fetch = original;
  };
}

let installedScenario: GbpScenario | null = null;

/** Installs the mock for this page load; later calls are no-ops. */
export function ensureGbpFetchMock(scenario: GbpScenario): void {
  if (installedScenario) return;
  installedScenario = scenario;
  installGbpFetchMock(scenario);
}
