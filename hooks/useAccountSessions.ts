'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { accountSessionsResponseSchema } from '@/lib/account/session-schema';
import { fetchJson } from '@/lib/http/fetchJson';
import { queryKeys } from '@/lib/query/keys';

export function useAccountSessions() {
  return useQuery({
    queryKey: queryKeys.account.sessions(),
    queryFn: async () => {
      const response = await fetchJson<unknown>('/api/account/sessions');
      return accountSessionsResponseSchema.parse(response).sessions;
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
    // Device identifiers and IP addresses must not be written to the persisted
    // localStorage query cache.
    meta: { persist: false },
  });
}

export function useRenameAccountDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ deviceId, name }: { deviceId: string; name: string }) =>
      fetchJson<{ status: 'ok' }>('/api/account/sessions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, name }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.account.sessions() });
    },
  });
}
