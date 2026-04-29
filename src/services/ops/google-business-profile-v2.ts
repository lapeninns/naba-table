/**
 * Phase 4 of the GBP Dual-Sync V2 architecture.
 *
 * Typed client contract for the V2 ops API. Exclusively talks to V2
 * routes; legacy contract is not mixed in.
 */

import { fetchJson } from '@/lib/http/fetchJson';
import { CSRF_HEADER_NAME, getBrowserCsrfToken } from '@/lib/security/csrf';

import type {
  SyncV2Decision,
  SyncV2DecisionInput,
  SyncV2DirectionIntent,
  SyncV2Draft,
  SyncV2PreflightResult,
  SyncV2PublishJob,
} from '@/server/google-business-profile-v2/types';

const v2Base = (restaurantId: string): string =>
  `/api/ops/restaurants/${restaurantId}/google-business-profile/v2`;

export interface CreateDraftV2Response {
  readonly draft: SyncV2Draft;
}

export async function createSyncV2Draft(
  restaurantId: string,
  options: { readonly refresh?: boolean } = {},
): Promise<CreateDraftV2Response> {
  return fetchJson<CreateDraftV2Response>(`${v2Base(restaurantId)}/drafts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refresh: options.refresh ?? false }),
  });
}

export interface GetDraftV2Response {
  readonly draft: SyncV2Draft;
  readonly decisions: ReadonlyArray<SyncV2Decision>;
}

export async function getSyncV2Draft(
  restaurantId: string,
  draftId: string,
): Promise<GetDraftV2Response> {
  return fetchJson<GetDraftV2Response>(`${v2Base(restaurantId)}/drafts/${draftId}`);
}

export interface UpsertDecisionsV2Response {
  readonly decisions: ReadonlyArray<SyncV2Decision>;
}

export async function upsertSyncV2Decisions(
  restaurantId: string,
  draftId: string,
  decisions: ReadonlyArray<SyncV2DecisionInput>,
): Promise<UpsertDecisionsV2Response> {
  return fetchJson<UpsertDecisionsV2Response>(`${v2Base(restaurantId)}/drafts/${draftId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ decisions }),
  });
}

export interface PreflightV2Response {
  readonly ok: true;
  readonly publishJob: SyncV2PublishJob;
  readonly preflight: SyncV2PreflightResult;
}

export interface PreflightV2ErrorResponse {
  readonly ok: false;
  readonly errors: SyncV2PreflightResult['errors'];
}

export async function runSyncV2Preflight(
  restaurantId: string,
  draftId: string,
  request: { directionIntent: SyncV2DirectionIntent; idempotencyKey: string },
): Promise<PreflightV2Response | PreflightV2ErrorResponse> {
  const headers = new Headers({
    accept: 'application/json',
    'content-type': 'application/json',
  });
  const csrfToken = getBrowserCsrfToken();
  if (csrfToken) {
    headers.set(CSRF_HEADER_NAME, csrfToken);
  }

  const response = await fetch(`${v2Base(restaurantId)}/drafts/${draftId}/preflight`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(request),
  });
  const parsed = (await response.json()) as
    | PreflightV2Response
    | PreflightV2ErrorResponse
    | { error?: string };

  if (!response.ok && 'ok' in parsed && parsed.ok === false) {
    return parsed;
  }
  if (!response.ok) {
    throw new Error('error' in parsed && parsed.error ? parsed.error : 'Unable to run preflight.');
  }

  return parsed as PreflightV2Response;
}

export interface PublishV2Response {
  readonly publishJob: SyncV2PublishJob;
  readonly nabatableEventId: string | null;
  readonly googleEventId: string | null;
  readonly rollbackEventId: string | null;
  readonly errors: SyncV2PreflightResult['errors'];
}

export async function executeSyncV2Publish(
  restaurantId: string,
  draftId: string,
  request: { publishJobId: string; confirmPassword: string },
): Promise<PublishV2Response> {
  return fetchJson<PublishV2Response>(`${v2Base(restaurantId)}/drafts/${draftId}/publish`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });
}

export async function retrySyncV2GooglePush(
  restaurantId: string,
  draftId: string,
  jobId: string,
): Promise<PublishV2Response> {
  return fetchJson<PublishV2Response>(
    `${v2Base(restaurantId)}/drafts/${draftId}/publish-jobs/${jobId}/retry-google-push`,
    { method: 'POST' },
  );
}
