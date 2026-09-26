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

/** Typing pause before the draft is re-rendered. The preview route allows 30 renders a minute. */
export const PREVIEW_DEBOUNCE_MS = 400;

/** Short, stable fingerprint of a draft for the preview cache key. */
function draftFingerprint(value: unknown): string {
  const text = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  }
  return `${(hash >>> 0).toString(36)}-${text.length}`;
}

/**
 * The server-rendered email for the variant being edited, including unsaved changes.
 *
 * A query, not a mutation: edits are debounced, a superseded render is aborted, identical drafts
 * are served from cache, and the last preview of the same email stays visible while the next
 * one renders.
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

  return useQuery<RestaurantEmailTemplatePreview, HttpError | Error>({
    queryKey: [
      ...queryKeys.opsRestaurants.emailTemplates(restaurantId ?? 'none'),
      'preview',
      request.templateKey,
      request.variantId,
      draftFingerprint(request.variants),
    ],
    queryFn: ({ signal }) =>
      restaurantService.previewEmailTemplate(
        restaurantId!,
        request.templateKey!,
        { preferredVariantId: request.variantId!, variants: [...request.variants] },
        { signal },
      ),
    enabled: ready,
    // Keep the last render of the same email on screen while the next one loads.
    placeholderData: (previous) =>
      previous?.templateKey === request.templateKey ? previous : undefined,
    staleTime: 5 * 60_000,
    gcTime: 60_000,
    // Draft previews are 4xx-final (validation, rate limit); only retry server hiccups once.
    retry: (failureCount, error) =>
      failureCount < 1 && !(error instanceof HttpError && error.status < 500),
    meta: { persist: false },
  });
}

export function useOpsSendRestaurantEmailTemplateTest(
  restaurantId?: string | null,
): UseMutationResult<
  SendTestEmailTemplateResponse,
  HttpError | Error,
  { templateKey: RestaurantBookingEmailTemplateKey; payload: SendTestEmailTemplateInput }
> {
  const restaurantService = useRestaurantService();

  return useMutation({
    mutationFn: async ({ templateKey, payload }) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return restaurantService.sendTestEmailTemplate(restaurantId, templateKey, payload);
    },
  });
}
