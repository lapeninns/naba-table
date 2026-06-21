'use client';

import { buildQueryStorageKey, clearPersistedQueryCache } from '@/lib/query/persist';
import { CSRF_HEADER_NAME, getBrowserCsrfToken } from '@/lib/security/csrf';
import { isMissingSessionAuthError } from '@/lib/supabase/auth-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

export async function signOutFromSupabase(): Promise<void> {
  const supabase = getSupabaseBrowserClient();

  // Capture the current user id before the session is torn down so we can wipe
  // their at-rest persisted query cache (which may hold booking/customer PII).
  let signedInUserId: string | null = null;
  try {
    const { data } = await supabase.auth.getSession();
    signedInUserId = data.session?.user?.id ?? null;
  } catch {
    // Best-effort: fall back to clearing the anonymous bucket below.
  }

  // Belt-and-braces: wipe the persisted (localStorage) query cache for this
  // user and the anonymous bucket. The provider auth effect also clears the
  // in-memory client + persisted cache, but this guarantees no at-rest PII
  // lingers even if that effect is delayed or never runs.
  const clearPersistedCaches = () => {
    clearPersistedQueryCache(buildQueryStorageKey(signedInUserId));
    clearPersistedQueryCache(buildQueryStorageKey(null));
  };

  try {
    const csrfToken = getBrowserCsrfToken();
    const response = await fetch('/api/auth/signout', {
      method: 'POST',
      credentials: 'include',
      headers: csrfToken ? { [CSRF_HEADER_NAME]: csrfToken } : undefined,
    });

    if (!response.ok) {
      console.error('[signOut] Server signout failed', { status: response.status });
    }
  } catch (error) {
    console.error('[signOut] Server signout error', error);
  }
  const { error } = await supabase.auth.signOut();

  if (error) {
    if (isMissingSessionAuthError(error)) {
      console.info('[signOut] Session already missing in browser client');
      clearPersistedCaches();
      return;
    }
    throw error;
  }

  clearPersistedCaches();
}
