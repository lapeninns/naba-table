import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useGuestPreferences } from '@/hooks/useGuestPreferences';

const session = vi.hoisted(() => ({
  value: { user: null as { id: string } | null, session: null, status: 'unauthenticated' },
}));

const supabase = vi.hoisted(() => ({
  auth: {
    updateUser: vi.fn(),
  },
}));

vi.mock('@/hooks/useSupabaseSession', () => ({
  useSupabaseSession: () => session.value,
}));

vi.mock('@/lib/supabase/browser', () => ({
  getSupabaseBrowserClient: () => supabase,
}));

const STORAGE_KEY = 'guest.preferences';

describe('useGuestPreferences', () => {
  beforeEach(() => {
    window.localStorage.clear();
    session.value = { user: null, session: null, status: 'unauthenticated' };
    supabase.auth.updateUser.mockResolvedValue({ data: {}, error: null });
  });

  it('@contract starts with empty preferences when nothing is stored', () => {
    const { result } = renderHook(() => useGuestPreferences());

    expect(result.current.preferences).toEqual({
      preferredPartySize: null,
      preferredTime: null,
    });
  });

  it('@contract hydrates preferences from localStorage', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ preferredPartySize: 4, preferredTime: '19:00' }),
    );

    const { result } = renderHook(() => useGuestPreferences());

    expect(result.current.preferences).toEqual({
      preferredPartySize: 4,
      preferredTime: '19:00',
    });
  });

  it('@contract falls back to nulls for corrupt or mistyped stored values', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not-json');
    const corrupt = renderHook(() => useGuestPreferences());
    expect(corrupt.result.current.preferences).toEqual({
      preferredPartySize: null,
      preferredTime: null,
    });
    corrupt.unmount();

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ preferredPartySize: 'four', preferredTime: 1900 }),
    );
    const mistyped = renderHook(() => useGuestPreferences());
    expect(mistyped.result.current.preferences).toEqual({
      preferredPartySize: null,
      preferredTime: null,
    });
  });

  it('@contract merges partial saves and persists them to localStorage', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ preferredPartySize: 2, preferredTime: '18:00' }),
    );

    const { result } = renderHook(() => useGuestPreferences());

    await act(async () => {
      await result.current.savePreferences({ preferredTime: '20:30' });
    });

    expect(result.current.preferences).toEqual({
      preferredPartySize: 2,
      preferredTime: '20:30',
    });
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual({
      preferredPartySize: 2,
      preferredTime: '20:30',
    });
  });

  it('@contract does not sync to Supabase while signed out', async () => {
    const { result } = renderHook(() => useGuestPreferences());

    await act(async () => {
      await result.current.savePreferences({ preferredPartySize: 6 });
    });

    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it('@contract @external-mock syncs preferences to auth metadata while signed in', async () => {
    session.value = { user: { id: 'user-1' }, session: null, status: 'authenticated' };

    const { result } = renderHook(() => useGuestPreferences());

    await act(async () => {
      await result.current.savePreferences({ preferredPartySize: 5, preferredTime: '19:15' });
    });

    await waitFor(() =>
      expect(supabase.auth.updateUser).toHaveBeenCalledWith({
        data: { preferred_party_size: 5, preferred_time: '19:15' },
      }),
    );
  });

  it('@contract @external-mock keeps local preferences when the Supabase sync fails', async () => {
    session.value = { user: { id: 'user-1' }, session: null, status: 'authenticated' };
    supabase.auth.updateUser.mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useGuestPreferences());

    await act(async () => {
      await expect(
        result.current.savePreferences({ preferredPartySize: 3 }),
      ).resolves.toBeUndefined();
    });

    expect(result.current.preferences.preferredPartySize).toBe(3);
  });
});
