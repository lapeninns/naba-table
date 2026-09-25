import 'server-only';

import { cache } from 'react';

import { getServerComponentSupabaseClient } from '@/server/supabase';

import type { AuthError, User } from '@supabase/supabase-js';

export type RequestUserResult = {
  user: User | null;
  error: AuthError | null;
};

/**
 * Resolves the signed-in Supabase user for the current server render.
 *
 * Wrapped in React `cache()` so nested layouts and pages rendered for the same
 * request share one `auth.getUser()` round trip. The cache is scoped to a
 * single React Server Components request, so no user leaks between requests.
 * Route handlers are not rendered by React and keep their own auth guards.
 */
export const getRequestUser = cache(async (): Promise<RequestUserResult> => {
  const supabase = await getServerComponentSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return { user, error };
});
