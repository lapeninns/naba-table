import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { guardTestEndpoint } from '@/server/security/test-endpoints';

/**
 * E2E Test Login Route
 *
 * This route allows E2E tests to programmatically log in as a user
 * without going through the magic link email flow.
 *
 * SECURITY: This route is protected by a shared secret E2E_TEST_TOKEN.
 * It should NEVER be exposed or usable in production without this token.
 */
export async function GET(request: NextRequest) {
  const guard = guardTestEndpoint(request);
  if (guard) return guard;

  // 1. Verify E2E Token
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token');
  const email = searchParams.get('email') || 'e2e-test@nabatable.com';

  let EXPECTED_TOKEN = process.env.E2E_TEST_TOKEN;

  // In local development, use a default token if not set
  if (!EXPECTED_TOKEN && process.env.NODE_ENV === 'development') {
    EXPECTED_TOKEN = 'local-dev-token';
    console.log('🚧 Using default E2E_TEST_TOKEN for local development');
  }

  // Fail if no token configured on server (safety mechanism)
  if (!EXPECTED_TOKEN) {
    console.error('❌ E2E_TEST_TOKEN not set on server. Denying access.');
    return NextResponse.json({ error: 'E2E login disabled' }, { status: 403 });
  }

  // Fail if token doesn't match
  if (token !== EXPECTED_TOKEN) {
    console.warn('⚠️ Invalid E2E token attempt.');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 2. Setup Supabase Admin Client (Service Role)
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!SERVICE_ROLE_KEY) {
      console.error('❌ SUPABASE_SERVICE_ROLE_KEY missing.');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 3. Robust Authentication: Reset Password & Sign In
    const TEMP_PASSWORD = 'E2E_Test_Password_123!';

    // Try to create user first
    const { error: createError } = await adminClient.auth.admin.createUser({
      email: email,
      password: TEMP_PASSWORD,
      email_confirm: true,
      user_metadata: { name: 'E2E Test User' },
    });

    // If creation failed (likely user exists), find and update password
    if (createError) {
      // Find ID via generateLink (only reliable email lookup for admin)
      const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
        type: 'magiclink',
        email: email,
      });

      if (linkError || !linkData.user) {
        console.error('User lookup failed:', linkError);
        return NextResponse.json({ error: 'User lookup failed' }, { status: 500 });
      }

      // Update password
      await adminClient.auth.admin.updateUserById(linkData.user.id, {
        password: TEMP_PASSWORD,
        email_confirm: true,
      });
    }

    // 4. Create Server Client to handle cookies and Sign In
    // Next.js 16 requires awaiting cookies()
    const cookieStore = await cookies();
    let sessionCookies: { name: string; value: string; options?: Record<string, unknown> }[] = [];

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            sessionCookies = cookiesToSet;
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, { ...options, secure: false }),
              );
              console.log('🍪 Set cookies for E2E session');
            } catch {
              // Ignore
            }
          },
        },
      },
    );

    // Sign in using the server client - this sets the cookies!
    const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
      email,
      password: TEMP_PASSWORD,
    });

    if (sessionError || !sessionData.session) {
      console.error('Error signing in:', sessionError);
      return NextResponse.json({ error: 'Session creation failed' }, { status: 500 });
    }

    // 5. Return the cookies to the client
    return NextResponse.json({
      success: true,
      cookies: sessionCookies,
      redirectUrl: '/guest/bookings',
    });
  } catch (error) {
    console.error('E2E Login Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
