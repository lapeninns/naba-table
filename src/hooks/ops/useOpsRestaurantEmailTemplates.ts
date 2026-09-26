'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { useRestaurantService } from '@/contexts/ops-services';
import { HttpError } from '@/lib/http/errors';
import { shouldRetryQuery } from '@/lib/query/client';
import { queryKeys } from '@/lib/query/keys';
import { OPS_SETTINGS_STALE_TIME } from '@/lib/query/staleTimes';
import { hashEmailTemplatePreviewInput } from '@/services/ops/email-templates';
import { useEmailTemplatesTransport } from '@src/hooks/ops/emailTemplatesTransport';

import type {
  RestaurantBookingEmailTemplateKey,
  RestaurantEmailTemplateVariant,
} from '@/lib/restaurants/email-templates';
import type {
  PreviewEmailTemplateInput,
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

/** Writes the canonical template returned by a save/reset into the cached snapshot. */
function writeTemplateIntoSnapshot(
  queryClient: QueryClient,
  restaurantId: string,
  template: RestaurantEmailTemplate,
): boolean {
  let replaced = false;
  queryClient.setQueryData<RestaurantEmailTemplatesSnapshot>(
    queryKeys.opsRestaurants.emailTemplates(restaurantId),
    (current) => {
      if (!current) return current;
      return {
        ...current,
        groups: current.groups.map((group) => ({
          ...group,
          templates: group.templates.map((existing) => {
            if (existing.key !== template.key) return existing;
            replaced = true;
            return template;
          }),
        })),
      };
    },
  );
  return replaced;
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
    // Saves and resets of one restaurant's templates apply in order.
    scope: { id: `email-templates:${restaurantId ?? 'none'}` },
    onSuccess: async (template) => {
      if (!restaurantId) return;
      // The server returns the canonical template; only a cache without it needs a refetch.
      if (!writeTemplateIntoSnapshot(queryClient, restaurantId, template)) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.opsRestaurants.emailTemplates(restaurantId),
        });
      }
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
    // Saves and resets of one restaurant's templates apply in order.
    scope: { id: `email-templates:${restaurantId ?? 'none'}` },
    onSuccess: async (template) => {
      if (!restaurantId) return;
      // The server returns the canonical template; only a cache without it needs a refetch.
      if (!writeTemplateIntoSnapshot(queryClient, restaurantId, template)) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.opsRestaurants.emailTemplates(restaurantId),
        });
      }
    },
  });
}

export const EMAIL_TEMPLATE_PREVIEW_DEBOUNCE_MS = 500;

export type EmailTemplatePreviewRequest = {
  templateKey: RestaurantBookingEmailTemplateKey;
  payload: PreviewEmailTemplateInput;
};

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timeoutId);
  }, [value, delayMs]);
  return debounced;
}

const PREVIEW_RATE_LIMIT_DEFAULT_WAIT_MS = 10_000;
const PREVIEW_RATE_LIMIT_MAX_WAIT_MS = 60_000;

function isRateLimited(error: unknown): error is HttpError {
  return error instanceof HttpError && error.status === 429;
}

/**
 * A rate-limited preview (429) is retried exactly once, after the server's Retry-After, so the
 * last draft still renders once the window frees up without hammering the limit.
 */
function shouldRetryPreview(failureCount: number, error: unknown): boolean {
  if (isRateLimited(error)) return failureCount < 1;
  return shouldRetryQuery(failureCount, error);
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
 * Live preview of a draft. It is a query, not a mutation per keystroke: the draft is debounced
 * (500 ms), keyed by a hash of its content (an unchanged draft reuses its render), a newer draft
 * aborts the stale request, and the previous render stays on screen while the next one loads.
 */
export function useOpsRestaurantEmailTemplatePreview(
  restaurantId: string | null | undefined,
  request: EmailTemplatePreviewRequest | null,
  options: { debounceMs?: number } = {},
): UseQueryResult<RestaurantEmailTemplatePreview, HttpError | Error> & {
  /** True while the latest draft has not been rendered yet (debounce or request in flight). */
  isPreviewStale: boolean;
} {
  const transport = useEmailTemplatesTransport();
  const debounceMs = options.debounceMs ?? EMAIL_TEMPLATE_PREVIEW_DEBOUNCE_MS;
  const requestHash = useMemo(
    () => (request ? hashEmailTemplatePreviewInput(request.payload) : null),
    [request],
  );
  const debouncedRequest = useDebouncedValue(request, debounceMs);
  const debouncedHash = useMemo(
    () => (debouncedRequest ? hashEmailTemplatePreviewInput(debouncedRequest.payload) : null),
    [debouncedRequest],
  );

  const query = useQuery<RestaurantEmailTemplatePreview, HttpError | Error>({
    queryKey: queryKeys.opsEmailTemplates.preview(
      restaurantId ?? 'none',
      debouncedRequest?.templateKey ?? 'none',
      debouncedHash ?? 'none',
    ),
    queryFn: ({ signal }) => {
      if (!restaurantId || !debouncedRequest) {
        throw new Error('Restaurant id and template are required');
      }
      return transport.previewEmailTemplate(
        restaurantId,
        debouncedRequest.templateKey,
        debouncedRequest.payload,
        { signal },
      );
    },
    enabled: Boolean(restaurantId && debouncedRequest),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
    retry: shouldRetryPreview,
    retryDelay: previewRetryDelay,
    meta: { persist: false },
  });

  return Object.assign(query, {
    isPreviewStale: requestHash !== debouncedHash || query.isFetching,
  });
}

export type SendTestEmailTemplateVariables = {
  templateKey: RestaurantBookingEmailTemplateKey;
  payload: SendTestEmailTemplateInput;
  /** Created once per click; a retried request with the same key is not sent twice. */
  idempotencyKey: string;
};

export function useOpsSendRestaurantEmailTemplateTest(
  restaurantId?: string | null,
): UseMutationResult<
  SendTestEmailTemplateResponse,
  HttpError | Error,
  SendTestEmailTemplateVariables
> {
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
    meta: {
      feedback: {
        success: (_data, variables) => {
          const toEmail = (variables as SendTestEmailTemplateVariables).payload.toEmail;
          return `Test email sent to ${toEmail}.`;
        },
        error: {
          copy: {
            RECIPIENT_SUPPRESSED:
              'That address is blocked after a bounce or complaint. Use a different address.',
            RATE_LIMITED: 'Too many test emails. Wait a minute and try again.',
            VALIDATION_FAILED: 'Enter a valid email address for the test send.',
          },
          fallback: 'The test email could not be sent. Try again.',
        },
      },
    },
  });
}
