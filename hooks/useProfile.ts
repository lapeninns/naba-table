'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { z } from 'zod';

import { track } from '@/lib/analytics';
import { emit } from '@/lib/analytics/emit';
import { fetchJson } from '@/lib/http/fetchJson';
import {
  profileResponseSchema,
  profileUpdateSchema,
  type ProfileResponse,
  type ProfileUpdatePayload,
} from '@/lib/profile/schema';
import { queryKeys } from '@/lib/query/keys';
import { generateIdempotencyKey } from '@/lib/utils/idempotency';

import type { HttpError } from '@/lib/http/errors';

const profileApiResponseSchema = z.object({
  profile: profileResponseSchema,
  idempotent: z.boolean().optional(),
});

type UseProfileOptions = {
  enabled?: boolean;
};

export function useProfile(options?: UseProfileOptions): UseQueryResult<ProfileResponse, HttpError> {
  return useQuery<ProfileResponse, HttpError>({
    queryKey: queryKeys.profile.self(),
    queryFn: async () => {
      const data = await fetchJson<unknown>('/api/profile');
      const parsed = profileApiResponseSchema.parse(data);
      return parsed.profile;
    },
    staleTime: 5 * 60 * 1000,
    enabled: options?.enabled ?? true,
  });
}

type ProfileMutationResult = {
  profile: ProfileResponse;
  idempotent: boolean;
};

/** One save intent: the payload and the idempotency key it keeps across retries (C5). */
export type ProfileUpdateVariables = {
  payload: ProfileUpdatePayload;
  idempotencyKey: string;
};

type ProfileUpdateContext = { previous?: ProfileResponse };

function payloadSignature(payload: ProfileUpdatePayload): string {
  const entries = Object.entries(payload).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
}

/**
 * The idempotency key for a profile save intent. The same payload gets the same key until
 * `reset()` (call it after a successful save), so a retry after a network error or 5xx is
 * recognised by the server as the same request; a changed payload gets a new key.
 */
export function useProfileSaveKey(): {
  keyFor: (payload: ProfileUpdatePayload) => string;
  reset: () => void;
} {
  const draftRef = useRef<{ signature: string; key: string } | null>(null);

  const keyFor = useCallback((payload: ProfileUpdatePayload) => {
    const signature = payloadSignature(payload);
    if (draftRef.current?.signature !== signature) {
      draftRef.current = { signature, key: generateIdempotencyKey() };
    }
    return draftRef.current.key;
  }, []);

  const reset = useCallback(() => {
    draftRef.current = null;
  }, []);

  return { keyFor, reset };
}

export function useUpdateProfile(): UseMutationResult<
  ProfileMutationResult,
  HttpError,
  ProfileUpdateVariables,
  ProfileUpdateContext
> {
  const queryClient = useQueryClient();

  return useMutation<
    ProfileMutationResult,
    HttpError,
    ProfileUpdateVariables,
    ProfileUpdateContext
  >({
    mutationFn: async ({ payload, idempotencyKey }) => {
      const data = await fetchJson<unknown>('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(payload),
      });
      const parsed = profileApiResponseSchema.parse(data);
      return {
        profile: parsed.profile,
        idempotent: parsed.idempotent ?? false,
      };
    },
    // The profile form shows save errors inline, with field messages.
    meta: { feedback: { error: false } },
    onMutate: async ({ payload }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.profile.self() });
      const previous = queryClient.getQueryData<ProfileResponse>(queryKeys.profile.self());

      if (previous) {
        const optimistic: ProfileResponse = {
          ...previous,
          name: Object.prototype.hasOwnProperty.call(payload, 'name')
            ? (payload.name ?? null)
            : previous.name,
          phone: Object.prototype.hasOwnProperty.call(payload, 'phone')
            ? (payload.phone ?? null)
            : previous.phone,
          image: Object.prototype.hasOwnProperty.call(payload, 'image')
            ? (payload.image ?? null)
            : previous.image,
          updatedAt: new Date().toISOString(),
        };
        queryClient.setQueryData(queryKeys.profile.self(), optimistic);
      }

      return { previous };
    },
    onSuccess: (result, { payload }) => {
      const profile = result.profile;
      // The server returns the canonical profile: store it, no refetch needed.
      queryClient.setQueryData(queryKeys.profile.self(), profile);
      const fields = Object.keys(payload ?? {});
      const analyticsPayload = {
        fields,
        hasAvatar: Boolean(profile.image),
        idempotent: result.idempotent,
      };
      track('profile_updated', analyticsPayload);
      emit('profile_updated', analyticsPayload);
      if (result.idempotent) {
        const duplicatePayload = {
          fields,
          hasAvatar: Boolean(profile.image),
        };
        track('profile_update_duplicate', duplicatePayload);
        emit('profile_update_duplicate', duplicatePayload);
      }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.profile.self(), context.previous);
      }
    },
  });
}

export function coerceProfileUpdatePayload(input: unknown): ProfileUpdatePayload {
  const result = profileUpdateSchema.safeParse(input);
  if (!result.success) {
    throw result.error;
  }
  return result.data;
}
