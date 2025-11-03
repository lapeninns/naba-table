import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Allowlisted redirect destinations (prefixes). Keep short and explicit.
const SAFE_REDIRECT_PREFIXES = [
  '/',
  '/ops',
  '/my-bookings',
  '/reserve',
  '/create',
  '/checkout',
  '/thank-you',
  '/invite',
];

function isSafeRedirectPath(path: string | null): boolean {
  if (!path || typeof path !== 'string') return false;
  // Disallow auth and API targets explicitly
  if (path.startsWith('/signin') || path.startsWith('/ops/login') || path.startsWith('/api/')) return false;
  return SAFE_REDIRECT_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const pathname = url.pathname;

  // Normalize ops login route (defense in depth with next.config redirects)
  if (pathname === '/ops/login') {
    const dest = new URL('/signin', url);
    dest.searchParams.set('context', 'ops');
    const rf = url.searchParams.get('redirectedFrom');
    if (isSafeRedirectPath(rf)) dest.searchParams.set('redirectedFrom', rf!);
    return NextResponse.redirect(dest);
  }

  // Sanitize redirectedFrom across the app
  const redirectedFrom = url.searchParams.get('redirectedFrom');
  if (redirectedFrom && !isSafeRedirectPath(redirectedFrom)) {
    url.searchParams.delete('redirectedFrom');
    const res = NextResponse.redirect(url);
    return res;
  }

  const response = NextResponse.next();

  // Strengthen privacy on the thank-you page by stripping referrers
  if (pathname === '/thank-you') {
    response.headers.set('Referrer-Policy', 'no-referrer');
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/|favicon.ico|fonts/).*)',
  ],
};

