import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { isMissingSessionAuthError } from '@/lib/supabase/auth-errors';
import { buildSupabaseCookieOptions, resolveCookieDomain } from '@/lib/supabase/cookies';
import { withCsrfProtectedMutation } from '@/server/security/csrf';

import type { Database } from '@/types/supabase';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost';
const COOKIE_DOMAIN = resolveCookieDomain(ROOT_DOMAIN);
const secureCookies = env.node.appEnv !== 'development';

const buildCookieConfig = (options: Record<string, unknown> = {}) => ({
  ...buildSupabaseCookieOptions({
    domain: COOKIE_DOMAIN,
    secure: secureCookies,
    sameSite: 'lax',
    httpOnly: true,
  }),
  ...options,
});

function expireAuthCookie(cookieStore: Awaited<ReturnType<typeof cookies>>, name: string): void {
  const expires = new Date(0);
  // Use set() with explicit domain/path to reliably expire cross-subdomain cookies.
  cookieStore.set({
    name,
    value: '',
    ...buildCookieConfig({
      maxAge: 0,
      expires,
    }),
  });
  // Best-effort delete for hosts that don't require explicit domain matching.
  try {
    cookieStore.delete(name);
  } catch (error) {
    console.warn(
      '[auth/signout] Cookie delete warning:',
      error instanceof Error ? error.message : String(error),
    );
  }
}

export async function POST(req: NextRequest) {
  return withCsrfProtectedMutation(req, () => postSignOut());
}

async function postSignOut() {
  const cookieStore = await cookies();

  // Create Supabase client that can clear cookies
  const supabase = createServerClient<Database>(env.supabase.url, env.supabase.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll().map(({ name, value }) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set({ name, value, ...buildCookieConfig(options) });
          });
        } catch (error) {
          console.warn(
            '[auth/signout] Cookie write warning:',
            error instanceof Error ? error.message : String(error),
          );
        }
      },
    },
  });

  // Sign out - this will trigger cookie deletion via setAll
  const { error } = await supabase.auth.signOut();

  if (error) {
    if (!isMissingSessionAuthError(error)) {
      console.error('[auth/signout] Sign-out warning:', error.message);
    }
  }

  // Explicitly delete auth cookies to be sure
  const authCookieNames = cookieStore
    .getAll()
    .filter((c) => c.name.startsWith('sb-'))
    .map((c) => c.name);

  for (const name of authCookieNames) {
    expireAuthCookie(cookieStore, name);
  }

  return NextResponse.json({
    success: true,
    alreadySignedOut: Boolean(error && isMissingSessionAuthError(error)),
  });
}
