import { act, renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { describe, expect, it, vi } from 'vitest';

import * as profileHooks from '@/hooks/useProfile';
import {
  coerceProfileUpdatePayload,
  useProfile,
  useProfileSaveKey,
  useUpdateProfile,
} from '@/hooks/useProfile';
import { track } from '@/lib/analytics';
import { HttpError } from '@/lib/http/errors';
import { fetchJson } from '@/lib/http/fetchJson';
import { queryKeys } from '@/lib/query/keys';

import type { ProfileResponse } from '@/lib/profile/schema';

vi.mock('@/lib/http/fetchJson', () => ({ fetchJson: vi.fn() }));
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }));
vi.mock('@/lib/analytics/emit', () => ({ emit: vi.fn() }));

const profile: ProfileResponse = {
  id: 'user-1',
  email: 'guest@example.com',
  name: 'Guest Person',
  phone: null,
  image: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

function setup<T>(hook: () => T) {
  const queryClient = createTestQueryClient();
  const wrapper = createQueryWrapper(queryClient);
  const rendered = renderHook(hook, { wrapper });
  return { queryClient, ...rendered };
}

describe('useProfile', () => {
  it('@contract fetches and unwraps the profile payload', async () => {
    vi.mocked(fetchJson).mockResolvedValue({ profile } as never);

    const { result } = setup(() => useProfile());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetchJson).toHaveBeenCalledWith('/api/profile');
    expect(result.current.data).toEqual(profile);
  });

  it('@contract rejects malformed profile payloads', async () => {
    vi.mocked(fetchJson).mockResolvedValue({ profile: { id: '' } } as never);

    const { result } = setup(() => useProfile());

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('@contract can be disabled via options', () => {
    const { result } = setup(() => useProfile({ enabled: false }));

    expect(result.current.fetchStatus).toBe('idle');
    expect(fetchJson).not.toHaveBeenCalled();
  });
});

describe('useUpdateProfile', () => {
  it('@contract sends an idempotency key and stores the returned profile', async () => {
    const updated = { ...profile, name: 'Renamed Guest' };
    vi.mocked(fetchJson).mockResolvedValue({ profile: updated, idempotent: false } as never);

    const { result, queryClient } = setup(() => useUpdateProfile());

    await result.current.mutateAsync({ payload: { name: 'Renamed Guest' }, idempotencyKey: 'key-1' });

    expect(fetchJson).toHaveBeenCalledWith(
      '/api/profile',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'Idempotency-Key': 'key-1',
        }),
        body: JSON.stringify({ name: 'Renamed Guest' }),
      }),
    );
    expect(queryClient.getQueryData(queryKeys.profile.self())).toEqual(updated);
    expect(track).toHaveBeenCalledWith(
      'profile_updated',
      expect.objectContaining({ fields: ['name'], idempotent: false }),
    );
  });

  it('@contract applies an optimistic update and rolls it back on error', async () => {
    const { result, queryClient } = setup(() => useUpdateProfile());
    queryClient.setQueryData(queryKeys.profile.self(), profile);

    let rejectRequest: (error: unknown) => void = () => {};
    vi.mocked(fetchJson).mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectRequest = reject;
        }),
    );

    const mutation = result.current.mutateAsync({
      payload: { name: 'Optimistic Name', phone: null },
      idempotencyKey: 'key-2',
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData<ProfileResponse>(queryKeys.profile.self());
      expect(cached?.name).toBe('Optimistic Name');
      expect(cached?.phone).toBeNull();
      expect(cached?.email).toBe(profile.email);
    });

    rejectRequest(new HttpError({ message: 'Conflict', status: 409, code: 'CONFLICT' }));
    await expect(mutation).rejects.toMatchObject({ status: 409 });

    await waitFor(() =>
      expect(queryClient.getQueryData(queryKeys.profile.self())).toEqual(profile),
    );
  });

  it('@contract reports duplicate submissions when the server flags idempotent replays', async () => {
    vi.mocked(fetchJson).mockResolvedValue({ profile, idempotent: true } as never);

    const { result } = setup(() => useUpdateProfile());

    await result.current.mutateAsync({ payload: { name: 'Guest Person' }, idempotencyKey: 'key-3' });

    expect(track).toHaveBeenCalledWith(
      'profile_update_duplicate',
      expect.objectContaining({ fields: ['name'] }),
    );
  });
});

describe('useUpdateProfile idempotency', () => {
  it('@contract sends the same key when a failed save is retried', async () => {
    vi.mocked(fetchJson)
      .mockRejectedValueOnce(new HttpError({ message: 'Server', status: 503, code: 'HTTP_503' }))
      .mockResolvedValueOnce({ profile, idempotent: true } as never);

    const { result } = setup(() => ({ save: useUpdateProfile(), keys: useProfileSaveKey() }));
    const payload = { name: 'Guest Person' };

    const firstKey = result.current.keys.keyFor(payload);
    await expect(
      result.current.save.mutateAsync({ payload, idempotencyKey: firstKey }),
    ).rejects.toMatchObject({ status: 503 });

    const retryKey = result.current.keys.keyFor({ name: 'Guest Person' });
    expect(retryKey).toBe(firstKey);
    await result.current.save.mutateAsync({ payload, idempotencyKey: retryKey });

    const sentKeys = vi
      .mocked(fetchJson)
      .mock.calls.map(([, init]) => (init?.headers as Record<string, string>)['Idempotency-Key']);
    expect(sentKeys).toEqual([firstKey, firstKey]);
  });

  it('@contract uses a new key once the payload changes or after a successful save', () => {
    const { result } = setup(() => useProfileSaveKey());

    const first = result.current.keyFor({ name: 'Guest Person', phone: null });
    // Same payload, different key order: same intent, same key.
    expect(result.current.keyFor({ phone: null, name: 'Guest Person' })).toBe(first);
    expect(result.current.keyFor({ name: 'Guest Person' })).not.toBe(first);

    const changed = result.current.keyFor({ name: 'Other Name' });
    expect(changed).not.toBe(first);

    act(() => result.current.reset());
    expect(result.current.keyFor({ name: 'Other Name' })).not.toBe(changed);
  });

  it('@contract declares inline error handling for the form', async () => {
    vi.mocked(fetchJson).mockResolvedValue({ profile } as never);
    const { result, queryClient } = setup(() => useUpdateProfile());

    await result.current.mutateAsync({ payload: { name: 'Guest Person' }, idempotencyKey: 'k' });

    expect(queryClient.getMutationCache().getAll()[0]?.options.meta?.feedback?.error).toBe(false);
  });
});

describe('profile avatar upload', () => {
  it('@contract has no unused avatar upload hook', () => {
    expect('useUploadProfileAvatar' in profileHooks).toBe(false);
  });
});

describe('coerceProfileUpdatePayload', () => {
  it('@contract throws on unknown fields and passes valid payloads through', () => {
    expect(() => coerceProfileUpdatePayload({ unknownField: true })).toThrow();
    expect(coerceProfileUpdatePayload({ name: 'Valid Name' })).toEqual({ name: 'Valid Name' });
  });
});
