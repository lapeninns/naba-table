'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useMemo } from 'react';

import { useRestaurantService } from '@/contexts/ops-services';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { HttpError } from '@/lib/http/errors';
import { queryKeys } from '@/lib/query/keys';
import { OPS_SETTINGS_STALE_TIME } from '@/lib/query/staleTimes';
import { hashEmailTemplatePreviewInput } from '@/services/ops/email-templates';
import { useEmailTemplatesTransport } from '@src/hooks/ops/emailTemplatesTransport';

import type {
  RestaurantBookingEmailTemplateKey,
  RestaurantEmailTemplateVariant,
} from '@/lib/restaurants/email-templates';
import type {
  RestaurantEmailTemplate,
  RestaurantEmailTemplatePreview,
  RestaurantEmailTemplatesSnapshot,
  SendTestEmailTemplateResponse,
  SendTestEmailTemplateInput,
} from '@/services/ops/restaurants';

export function useOpsRestaurantEmailTemplates(
  restaurantId?: string | null,
): UseQueryResult<RestaurantEmailTemplatesSnapshot, HttpError> {
  const restaurantService = useRestaurantService();

  return useQuery<RestaurantEmailTemplatesSnapshot, HttpError>({
    queryKey: restaurantId
      ? queryKeys.opsRestaurants.emailTemplates(restaurantId)
      : queryKeys.opsRestaurants.emailTemplates('none'),
    queryFn: ({ signal }) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return restaurantService.getEmailTemplates(restaurantId, { signal });
    },
    enabled: Boolean(restaurantId),
    staleTime: OPS_SETTINGS_STALE_TIME.emailTemplates,
    // Email templates stay out of the localStorage query cache (see lib/query/persist.ts).
    meta: { persist: false },
  });
}

/** The snapshot with one template swapped for the server's latest copy of it. */
export function replaceTemplateInSnapshot(
  snapshot: RestaurantEmailTemplatesSnapshot | undefined,
  template: RestaurantEmailTemplate,
): RestaurantEmailTemplatesSnapshot | undefined {
  if (!snapshot) return snapshot;
  return {
    ...snapshot,
    groups: snapshot.groups.map((group) =>
      group.templates.some((candidate) => candidate.key === template.key)
        ? {
            ...group,
            templates: group.templates.map((candidate) =>
              candidate.key === template.key ? template : candidate,
            ),
          }
        : group,
    ),
  };
}

/**
 * Save and reset both return the template as the server now has it, so the cache is updated in
 * place instead of refetching every template.
 */
async function writeTemplate(
  queryClient: QueryClient,
  restaurantId: string,
  template: RestaurantEmailTemplate,
) {
  const queryKey = queryKeys.opsRestaurants.emailTemplates(restaurantId);
  // A refetch started before the save would overwrite it with older copy.
  await queryClient.cancelQueries({ queryKey, exact: true });
  queryClient.setQueryData<RestaurantEmailTemplatesSnapshot>(queryKey, (snapshot) =>
    replaceTemplateInSnapshot(snapshot, template),
  );
}

export function useOpsUpdateRestaurantEmailTemplate(
  restaurantId?: string | null,
): UseMutationResult<
  RestaurantEmailTemplate,
  HttpError | Error,
  { templateKey: RestaurantBookingEmailTemplateKey; variants: RestaurantEmailTemplateVariant[] }
> {
  const restaurantService = useRestaurantService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ templateKey, variants }) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return restaurantService.updateEmailTemplate(restaurantId, templateKey, { variants });
    },
    onSuccess: async (template) => {
      if (restaurantId) await writeTemplate(queryClient, restaurantId, template);
    },
  });
}

export function useOpsResetRestaurantEmailTemplate(
  restaurantId?: string | null,
): UseMutationResult<
  RestaurantEmailTemplate,
  HttpError | Error,
  { templateKey: RestaurantBookingEmailTemplateKey }
> {
  const restaurantService = useRestaurantService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ templateKey }) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return restaurantService.resetEmailTemplate(restaurantId, templateKey);
    },
    onSuccess: async (template) => {
      if (restaurantId) await writeTemplate(queryClient, restaurantId, template);
    },
  });
}

/** Typing pause before the draft is re-rendered (the preview route allows 30 renders a minute). */
export const PREVIEW_DEBOUNCE_MS = 500;

/**
 * Client-side budget for draft renders. The preview route allows 30 a minute per restaurant;
 * staying under it leaves room for other tabs and staff, so slow typing never hits a 429.
 */
export const PREVIEW_RATE_LIMIT = { limit: 24, windowMs: 60_000 } as const;

/** Render start times per restaurant, shared by every preview in this tab. */
const previewRenderTimes = new Map<string, number[]>();

function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(signal.reason);
    }
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Waits until the rolling window has room, then claims a slot. A newer draft aborts the wait,
 * so only the latest draft is rendered once the window frees up.
 */
async function takePreviewSlot(restaurantId: string, signal: AbortSignal): Promise<void> {
  const { limit, windowMs } = PREVIEW_RATE_LIMIT;
  for (;;) {
    const now = Date.now();
    const times = (previewRenderTimes.get(restaurantId) ?? []).filter(
      (startedAt) => now - startedAt < windowMs,
    );
    if (times.length < limit) {
      previewRenderTimes.set(restaurantId, [...times, now]);
      return;
    }
    previewRenderTimes.set(restaurantId, times);
    await abortableDelay(times[0]! + windowMs - now, signal);
  }
}

const PREVIEW_RATE_LIMIT_DEFAULT_WAIT_MS = 10_000;
const PREVIEW_RATE_LIMIT_MAX_WAIT_MS = 60_000;

function isRateLimited(error: unknown): error is HttpError {
  return error instanceof HttpError && error.status === 429;
}

/**
 * Draft previews are otherwise 4xx-final (validation); a server hiccup is retried once. A 429
 * (another tab or staff member used the route's budget) is retried exactly once, after the
 * server's Retry-After, so the last draft still renders without hammering the limit.
 */
function shouldRetryPreview(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) return false;
  if (isRateLimited(error)) return true;
  return !(error instanceof HttpError && error.status < 500);
}

function previewRetryDelay(failureCount: number, error: unknown): number {
  if (isRateLimited(error)) {
    const waitMs =
      typeof error.retryAfter === 'number' && error.retryAfter > 0
        ? error.retryAfter * 1000
        : PREVIEW_RATE_LIMIT_DEFAULT_WAIT_MS;
    return Math.min(waitMs, PREVIEW_RATE_LIMIT_MAX_WAIT_MS);
  }
  return Math.min(1000 * 2 ** failureCount, 30_000);
}

/**
 * The server-rendered email for the variant being edited, including unsaved changes.
 *
 * A query, not a mutation per keystroke: edits are debounced (500 ms) and kept under the route's
 * rate limit, the key is a hash of the draft (an identical draft is served from cache), a
 * superseded render is aborted through its AbortSignal, and the last preview of the same email
 * stays visible while the next one renders.
 */
export function useOpsEmailTemplatePreview({
  restaurantId,
  templateKey,
  variantId,
  variants,
  debounceMs = PREVIEW_DEBOUNCE_MS,
}: {
  restaurantId: string | null | undefined;
  templateKey: RestaurantBookingEmailTemplateKey | null;
  variantId: string | null;
  variants: ReadonlyArray<RestaurantEmailTemplateVariant>;
  debounceMs?: number;
}): UseQueryResult<RestaurantEmailTemplatePreview, HttpError | Error> {
  const restaurantService = useRestaurantService();
  // Memoised so only a real change to the draft restarts the debounce timer.
  const latest = useMemo(
    () => ({ templateKey, variantId, variants }),
    [templateKey, variantId, variants],
  );
  const settled = useDebouncedValue(latest, debounceMs);
  // Edits wait for typing to pause; opening another email or variant renders straight away.
  const request =
    settled.templateKey === templateKey && settled.variantId === variantId ? settled : latest;
  const ready = Boolean(
    restaurantId && request.templateKey && request.variantId && request.variants.length > 0,
  );
  const draftHash = useMemo(
    () =>
      hashEmailTemplatePreviewInput({
        preferredVariantId: request.variantId ?? undefined,
        variants: [...request.variants],
      }),
    [request],
  );

  return useQuery<RestaurantEmailTemplatePreview, HttpError | Error>({
    queryKey: queryKeys.opsEmailTemplates.preview(
      restaurantId ?? 'none',
      request.templateKey ?? 'none',
      draftHash,
    ),
    queryFn: async ({ signal }) => {
      await takePreviewSlot(restaurantId!, signal);
      return restaurantService.previewEmailTemplate(
        restaurantId!,
        request.templateKey!,
        { preferredVariantId: request.variantId!, variants: [...request.variants] },
        { signal },
      );
    },
    enabled: ready,
    // Keep the last render of the same email on screen while the next one loads.
    placeholderData: (previous) =>
      previous?.templateKey === request.templateKey ? previous : undefined,
    staleTime: 5 * 60_000,
    gcTime: 60_000,
    retry: shouldRetryPreview,
    retryDelay: previewRetryDelay,
    meta: { persist: false },
  });
}

export type SendTestEmailTemplateVariables = {
  templateKey: RestaurantBookingEmailTemplateKey;
  payload: SendTestEmailTemplateInput;
  /** One key per send intent; a retried intent reuses it, so the provider never sends twice. */
  idempotencyKey: string;
};

/** Copy for test-send failures, keyed by the route's C1 error codes (see toUserMessage). */
export const TEST_SEND_ERROR_COPY = {
  RECIPIENT_SUPPRESSED:
    'That address is blocked after a bounce or complaint. Use a different address.',
  RATE_LIMITED: 'Too many test emails. Wait a minute and try again.',
  VALIDATION_FAILED: 'Enter a valid email address for the test send.',
} as const;

export function useOpsSendRestaurantEmailTemplateTest(
  restaurantId?: string | null,
): UseMutationResult<
  SendTestEmailTemplateResponse,
  HttpError | Error,
  SendTestEmailTemplateVariables
> {
  // The transport carries the Idempotency-Key header, which RestaurantService has no slot for.
  const transport = useEmailTemplatesTransport();

  return useMutation({
    mutationFn: async ({ templateKey, payload, idempotencyKey }) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return transport.sendTestEmailTemplate(restaurantId, templateKey, payload, {
        idempotencyKey,
      });
    },
  });
}
