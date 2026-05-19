'use client';

import { CSRF_HEADER_NAME, getBrowserCsrfToken } from '@/lib/security/csrf';
import { isMissingSessionAuthError } from '@/lib/supabase/auth-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

export async function signOutFromSupabase(): Promise<void> {
  const supabase = getSupabaseBrowserClient();
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
      return;
    }
    throw error;
  }
}
