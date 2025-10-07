'use client';

import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
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

const profileApiResponseSchema = z.object({ profile: profileResponseSchema });

export function useProfile(): UseQueryResult<ProfileResponse, HttpError> {
  return useQuery<ProfileResponse, HttpError>({
    queryKey: queryKeys.profile.self(),
    queryFn: async () => {
      const data = await fetchJson<unknown>('/api/profile');
      const parsed = profileApiResponseSchema.parse(data);
      return parsed.profile;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateProfile(): UseMutationResult<ProfileResponse, HttpError, ProfileUpdatePayload, { previous?: ProfileResponse; payload: ProfileUpdatePayload }> {
  const queryClient = useQueryClient();

  return useMutation<ProfileResponse, HttpError, ProfileUpdatePayload, { previous?: ProfileResponse; payload: ProfileUpdatePayload }>({
    mutationFn: async (payload) => {
      const body = JSON.stringify(payload);
      const data = await fetchJson<unknown>('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const parsed = profileApiResponseSchema.parse(data);
      return parsed.profile;
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
    onSuccess: (profile, variables, context) => {
      queryClient.setQueryData(queryKeys.profile.self(), profile);
      const fields = Object.keys(variables ?? {});
      const analyticsPayload = {
        fields,
        hasAvatar: Boolean(profile.image),
      };
      track('profile_updated', analyticsPayload);
      emit('profile_updated', analyticsPayload);
      toast.success('Profile updated');
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
