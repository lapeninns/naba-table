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

export function useUpdateProfile(): UseMutationResult<ProfileResponse, HttpError, ProfileUpdatePayload> {
  const queryClient = useQueryClient();

  return useMutation<ProfileResponse, HttpError, ProfileUpdatePayload>({
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
    onSuccess: (profile) => {
      queryClient.setQueryData(queryKeys.profile.self(), profile);
      toast.success('Profile updated');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}

export function useUploadProfileAvatar(): UseMutationResult<ProfileUploadResponse, HttpError, File> {
  return useMutation<ProfileUploadResponse, HttpError, File>({
    mutationFn: async (file) => {
      const formData = new FormData();
      formData.append('file', file);

      const data = await fetchJson<unknown>('/api/profile/image', {
        method: 'POST',
        body: formData,
      });

      return profileUploadResponseSchema.parse(data);
    },
    onError: (error) => {
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
