import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { useUpdateProfile } from '@/hooks/useProfile';
import { track } from '@/lib/analytics';
import { emit } from '@/lib/analytics/emit';
import { fetchJson } from '@/lib/http/fetchJson';

import type { ProfileResponse, ProfileUpdatePayload } from '@/lib/profile/schema';

vi.mock('@/lib/http/fetchJson', () => ({
  fetchJson: vi.fn(),
}));

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
}));

vi.mock('@/lib/analytics/emit', () => ({
  emit: vi.fn(),
}));

const mockedFetchJson = vi.mocked(fetchJson);
const mockedTrack = vi.mocked(track);
const mockedEmit = vi.mocked(emit);

const TEST_PROFILE: ProfileResponse = {
  id: '00000000-0000-4000-8000-000000000000',
  email: 'ada@example.com',
  name: 'Ada',
  phone: '+14155550100',
  image: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('useUpdateProfile', () => {
  const originalCrypto = globalThis.crypto;

  beforeAll(() => {
    vi.stubGlobal('crypto', {
      randomUUID: () => 'test-idempotency-key',
    });
  });

  afterAll(() => {
    vi.stubGlobal('crypto', originalCrypto);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderUseUpdateProfile() {
    const queryClient = new QueryClient();
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    }
    return renderHook(() => useUpdateProfile(), { wrapper });
  }

  it('sends idempotency header and reports duplicate analytics', async () => {
    mockedFetchJson.mockResolvedValue({
      profile: { ...TEST_PROFILE, name: 'Ada Lovelace' },
      idempotent: true,
    });

    const { result } = renderUseUpdateProfile();
    const payload: ProfileUpdatePayload = { name: 'Ada Lovelace' };

    await act(async () => {
      await result.current.mutateAsync(payload);
    });

    expect(mockedFetchJson).toHaveBeenCalledWith(
      '/api/profile',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Idempotency-Key': 'test-idempotency-key',
        }),
      }),
    );

    expect(mockedTrack).toHaveBeenCalledWith(
      'profile_update_duplicate',
      expect.objectContaining({ fields: ['name'] }),
    );
    expect(mockedEmit).toHaveBeenCalledWith(
      'profile_update_duplicate',
      expect.objectContaining({ fields: ['name'] }),
    );
  });
});
