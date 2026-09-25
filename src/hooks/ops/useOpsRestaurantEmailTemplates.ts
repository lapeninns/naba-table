'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { useRestaurantService } from '@/contexts/ops-services';
import { queryKeys } from '@/lib/query/keys';
import { OPS_SETTINGS_STALE_TIME } from '@/lib/query/staleTimes';

import type { HttpError } from '@/lib/http/errors';
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
    onSuccess: async () => {
      if (!restaurantId) return;
      await queryClient.invalidateQueries({
        queryKey: queryKeys.opsRestaurants.emailTemplates(restaurantId),
      });
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
    onSuccess: async () => {
      if (!restaurantId) return;
      await queryClient.invalidateQueries({
        queryKey: queryKeys.opsRestaurants.emailTemplates(restaurantId),
      });
    },
  });
}

export function useOpsPreviewRestaurantEmailTemplate(
  restaurantId?: string | null,
): UseMutationResult<
  RestaurantEmailTemplatePreview,
  HttpError | Error,
  { templateKey: RestaurantBookingEmailTemplateKey; payload?: PreviewEmailTemplateInput }
> {
  const restaurantService = useRestaurantService();

  return useMutation({
    mutationFn: async ({ templateKey, payload }) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return restaurantService.previewEmailTemplate(restaurantId, templateKey, payload);
    },
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
