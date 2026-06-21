import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { sanitizeLocalRedirectPath } from '@/lib/url/safe-local-path';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (process.env.QA_ENABLE_AUTH_FIXTURES !== '1') {
    return new Response('Not Authorized in this environment', { status: 403 });
  }

  const cookieStore = await cookies();

  cookieStore.set({
    name: '__nabatable_qa_ops_auth',
    value: 'enabled',
    path: '/',
    sameSite: 'lax',
    httpOnly: false,
  });

  const { searchParams } = new URL(request.url);
  const redirectTo = sanitizeLocalRedirectPath(searchParams.get('redirect'), {
    fallback: '/settings/restaurant',
  });

  // Use the Host header or standard request URL to ensure proper subdomain routing
  const host = request.headers.get('host') || 'app.localhost:5180';
  const protocol = host.includes('localhost') ? 'http' : 'https';

  return NextResponse.redirect(new URL(redirectTo, `${protocol}://${host}`));
}
