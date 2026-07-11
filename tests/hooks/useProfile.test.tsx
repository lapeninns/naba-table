import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { describe, expect, it, vi } from 'vitest';

import {
  coerceProfileUpdatePayload,
  useProfile,
  useUpdateProfile,
  useUploadProfileAvatar,
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

    await result.current.mutateAsync({ name: 'Renamed Guest' });

    expect(fetchJson).toHaveBeenCalledWith(
      '/api/profile',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'Idempotency-Key': expect.any(String),
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

    const mutation = result.current.mutateAsync({ name: 'Optimistic Name', phone: null });

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

    await result.current.mutateAsync({ name: 'Guest Person' });

    expect(track).toHaveBeenCalledWith(
      'profile_update_duplicate',
      expect.objectContaining({ fields: ['name'] }),
    );
  });
});

describe('useUploadProfileAvatar', () => {
  it('@contract posts the file as multipart form data', async () => {
    const upload = { path: 'avatars/user-1.png', url: 'https://cdn.example.com/a.png', cacheKey: 'k1' };
    vi.mocked(fetchJson).mockResolvedValue(upload as never);

    const { result } = setup(() => useUploadProfileAvatar());
    const file = new File(['binary'], 'avatar.png', { type: 'image/png' });

    await expect(result.current.mutateAsync(file)).resolves.toEqual(upload);

    const [url, init] = vi.mocked(fetchJson).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/profile/image');
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get('file')).toBe(file);
  });

  it('@contract tracks upload failures with the file metadata', async () => {
    vi.mocked(fetchJson).mockRejectedValue(
      new HttpError({ message: 'Too large', status: 413, code: 'PAYLOAD_TOO_LARGE' }),
    );

    const { result } = setup(() => useUploadProfileAvatar());
    const file = new File(['0123456789'], 'avatar.png', { type: 'image/png' });

    await expect(result.current.mutateAsync(file)).rejects.toMatchObject({ status: 413 });

    expect(track).toHaveBeenCalledWith('profile_upload_error', {
      code: 'PAYLOAD_TOO_LARGE',
      status: 413,
      size: file.size,
      type: 'image/png',
    });
  });
});

describe('coerceProfileUpdatePayload', () => {
  it('@contract throws on unknown fields and passes valid payloads through', () => {
    expect(() => coerceProfileUpdatePayload({ unknownField: true })).toThrow();
    expect(coerceProfileUpdatePayload({ name: 'Valid Name' })).toEqual({ name: 'Valid Name' });
  });
});
