'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useSupabaseSession } from '@/hooks/useSupabaseSession';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

export type GuestPreferences = {
  preferredPartySize: number | null;
  preferredTime: string | null; // HH:MM
};

const STORAGE_KEY = 'guest.preferences';

const readLocal = (): GuestPreferences => {
  if (typeof window === 'undefined') return { preferredPartySize: null, preferredTime: null };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { preferredPartySize: null, preferredTime: null };
    const parsed = JSON.parse(raw) as Partial<GuestPreferences>;
    return {
      preferredPartySize: typeof parsed.preferredPartySize === 'number' ? parsed.preferredPartySize : null,
      preferredTime: typeof parsed.preferredTime === 'string' ? parsed.preferredTime : null,
    };
  } catch {
    return { preferredPartySize: null, preferredTime: null };
  }
};

const writeLocal = (prefs: GuestPreferences) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore storage errors
  }
};

export function useGuestPreferences() {
  const { user } = useSupabaseSession();
  const [prefs, setPrefs] = useState<GuestPreferences>(() => readLocal());
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  useEffect(() => {
    setPrefs(readLocal());
  }, []);

  const save = useCallback(
    async (next: Partial<GuestPreferences>) => {
      setPrefs((prev) => {
        const merged: GuestPreferences = {
          preferredPartySize:
            next.preferredPartySize === undefined ? prev.preferredPartySize : next.preferredPartySize,
          preferredTime: next.preferredTime === undefined ? prev.preferredTime : next.preferredTime,
        };
        writeLocal(merged);
        return merged;
      });

      if (user) {
        try {
          await supabase.auth.updateUser({
            data: {
              preferred_party_size: next.preferredPartySize,
              preferred_time: next.preferredTime,
            },
          });
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
             
            console.warn('[preferences] failed to sync to auth metadata', error);
          }
        }
      }
    },
    [supabase.auth, user],
  );

  return { preferences: prefs, savePreferences: save };
}
