'use client';

import { useRef } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { z } from 'zod';

import { fetchJson } from '@/lib/http/fetchJson';
import type { HttpError } from '@/lib/http/errors';
import { queryKeys } from '@/lib/query/keys';
import {
  profileResponseSchema,
  profileUpdateSchema,
  profileUploadResponseSchema,
  type ProfileResponse,
  type ProfileUpdatePayload,
  type ProfileUploadResponse,
} from '@/lib/profile/schema';
import { track } from '@/lib/analytics';
import { emit } from '@/lib/analytics/emit';

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

export function useUpdateProfile(): UseMutationResult<
  ProfileMutationResult,
  HttpError,
  ProfileUpdatePayload,
  { previous?: ProfileResponse; payload: ProfileUpdatePayload }
> {
  const queryClient = useQueryClient();
  const idempotencyKeyRef = useRef<string | null>(null);

  return useMutation<ProfileMutationResult, HttpError, ProfileUpdatePayload, { previous?: ProfileResponse; payload: ProfileUpdatePayload }>({
    mutationFn: async (payload) => {
      const body = JSON.stringify(payload);
      const idempotencyKey =
        idempotencyKeyRef.current ??
        (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      idempotencyKeyRef.current = idempotencyKey;
      try {
        const data = await fetchJson<unknown>('/api/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey,
          },
          body,
        });
        const parsed = profileApiResponseSchema.parse(data);
        return {
          profile: parsed.profile,
          idempotent: parsed.idempotent ?? false,
        };
      } finally {
        idempotencyKeyRef.current = null;
      }
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.profile.self() });
      const previous = queryClient.getQueryData<ProfileResponse>(queryKeys.profile.self());

      if (previous) {
        const optimistic: ProfileResponse = {
          ...previous,
          name: Object.prototype.hasOwnProperty.call(payload, 'name')
            ? payload.name ?? null
            : previous.name,
          phone: Object.prototype.hasOwnProperty.call(payload, 'phone')
            ? payload.phone ?? null
            : previous.phone,
          image: Object.prototype.hasOwnProperty.call(payload, 'image')
            ? payload.image ?? null
            : previous.image,
          updatedAt: new Date().toISOString(),
        };
        queryClient.setQueryData(queryKeys.profile.self(), optimistic);
      }

      return { previous, payload };
    },
    onSuccess: (result, variables, context) => {
      const profile = result.profile;
      queryClient.setQueryData(queryKeys.profile.self(), profile);
      const fields = Object.keys(variables ?? {});
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
      toast.success(result.idempotent ? 'Profile already up to date' : 'Profile updated');
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.profile.self(), context.previous);
      }
      toast.error(error.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.self() });
    },
  });
}

export function useUploadProfileAvatar(): UseMutationResult<ProfileUploadResponse, HttpError, File, { file: File }> {
  return useMutation<ProfileUploadResponse, HttpError, File, { file: File }>({
    mutationFn: async (file) => {
      const formData = new FormData();
      formData.append('file', file);

      const data = await fetchJson<unknown>('/api/profile/image', {
        method: 'POST',
        body: formData,
      });

      return profileUploadResponseSchema.parse(data);
    },
    onMutate: (file) => ({ file }),
    onError: (error, _variables, context) => {
      const analyticsPayload = {
        code: error.code,
        status: error.status,
        size: context?.file?.size,
        type: context?.file?.type,
      };
      track('profile_upload_error', analyticsPayload);
      emit('profile_upload_error', analyticsPayload);
      toast.error(error.message);
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
