import { AlertCircle, BarChart3, Users, Calendar, Shield } from 'lucide-react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { OpsSignInForm } from '@/components/auth/OpsSignInForm';
import { ensureCsrfCookie } from '@/server/security/csrf';
import { getServerComponentSupabaseClient } from '@/server/supabase';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign in to operations · Nab a Table',
  description: 'Access the restaurant operations console to manage bookings and your team.',
};

export const dynamic = 'force-dynamic';

type OpsLoginSearchParams = {
  redirectedFrom?: string | string[];
  error?: string;
  message?: string;
};

type OpsLoginPageProps = {
  searchParams: Promise<OpsLoginSearchParams>;
};

const ALLOWED_REDIRECT_PREFIXES = [
  '/app',
  '/guest',
  '/restaurants',
  '/dashboard',
  '/bookings',
  '/customers',
  '/settings',
  '/new-bookings',
] as const;

function resolveRedirectTarget(raw: string | string[] | undefined): string {
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  if (typeof candidate !== 'string' || !candidate.startsWith('/') || candidate.startsWith('//'))
    return '/app';

  const parsed = new URL(candidate, 'https://sajiloreservex.local');
  const pathname = parsed.pathname;

  const isAllowed = ALLOWED_REDIRECT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  return isAllowed ? candidate : '/app';
}

const INVALID_CLIENT_ID_SAFE_MESSAGE =
  'Sign-in is temporarily unavailable due to an authentication provider setup issue. Please contact support or try again later.';

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeAuthMessage(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const decoded = safeDecodeURIComponent(raw).trim();
  const parts = [decoded];

  if (decoded.startsWith('{') && decoded.endsWith('}')) {
    try {
      const parsed = JSON.parse(decoded) as {
        error?: string;
        error_description?: string;
        message?: string;
      };
      if (typeof parsed.error === 'string') parts.push(parsed.error);
      if (typeof parsed.error_description === 'string') parts.push(parsed.error_description);
      if (typeof parsed.message === 'string') parts.push(parsed.message);
    } catch {
      // Keep decoded value when payload is not valid JSON.
    }
  }

  const normalized = parts.join(' ').toLowerCase();
  if (
    normalized.includes('invalid_client_id') ||
    normalized.includes('invalid client_id parameter value')
  ) {
    return INVALID_CLIENT_ID_SAFE_MESSAGE;
  }

  return decoded;
}

export default async function OpsAuthSignInPage({ searchParams }: OpsLoginPageProps) {
  await ensureCsrfCookie();

  const resolvedParams = await searchParams;
  const redirectTarget = resolveRedirectTarget(resolvedParams?.redirectedFrom);

  // Build guest sign-in URL for cross-subdomain navigation
  const headersList = await headers();
  const hostHeader = headersList.get('host') ?? '';
  const hostPort = hostHeader.includes(':') ? hostHeader.split(':').pop() : undefined;
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost';
  const guestSignInUrl =
    rootDomain === 'localhost'
      ? `http://localhost${hostPort ? `:${hostPort}` : ''}/auth/signin`
      : `https://${rootDomain.toLowerCase().replace(/^www\./, '')}/auth/signin`;

  // Extract error info from URL params
  const errorType = resolvedParams?.error;
  const errorMessage = normalizeAuthMessage(resolvedParams?.message);
  const hasError = !!errorType;

  // Only redirect authenticated users if there's no error
  // Using getUser() which validates the JWT with the server, not just reads cached session
  // This prevents redirect loops after logout since getSession() returns stale cached data
  if (!hasError) {
    const supabase = await getServerComponentSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    // Only redirect if we have a valid user AND no error
    if (user && !error) {
      redirect(redirectTarget);
    }
  }

  return (
    <div className="w-full">
      {/* Hero Section */}
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          {/* Left Column - Value Proposition */}
          <div className="order-2 flex flex-col justify-center space-y-6 lg:order-1">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-700">
                <Shield className="h-4 w-4" />
                Trusted by 200+ restaurants
              </div>

              <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                Streamline your restaurant operations
              </h1>

              <p className="text-lg text-slate-600">
                Access your operations console to manage bookings, optimize seating, and keep your
                team aligned—all in real-time.
              </p>
            </div>

            {/* Features Grid */}
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3.5">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-slate-900">Real-time bookings</h3>
                  <p className="mt-0.5 text-xs text-slate-600">
                    Manage all reservations with live updates
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3.5">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-green-100">
                  <BarChart3 className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-slate-900">Powerful analytics</h3>
                  <p className="mt-0.5 text-xs text-slate-600">
                    Track covers, peak hours, and revenue trends
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3.5">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-purple-100">
                  <Users className="h-5 w-5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-slate-900">Team collaboration</h3>
                  <p className="mt-0.5 text-xs text-slate-600">
                    Role-based access with activity logs
                  </p>
                </div>
              </div>
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <Shield className="h-4 w-4 flex-shrink-0 text-blue-600" />
              <span className="text-xs font-semibold text-blue-900">Enterprise Security:</span>
              <span className="text-xs text-blue-800">SOC 2 Type II</span>
              <span className="text-blue-400">•</span>
              <span className="text-xs text-blue-800">99.9% uptime</span>
              <span className="text-blue-400">•</span>
              <span className="text-xs text-blue-800">End-to-end encryption</span>
            </div>
          </div>

          {/* Right Column - Sign In Form */}
          <div className="order-1 flex flex-col justify-center lg:order-2">
            {/* Error Alert */}
            {hasError && errorMessage && (
              <div
                role="alert"
                className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"
              >
                <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-500" aria-hidden="true" />
                <div className="text-sm">
                  <p className="font-medium">Unable to sign in</p>
                  <p className="mt-1 text-red-700">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Sign-in Card */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-xl">
              <div className="p-6 sm:p-8">
                <OpsSignInForm redirectedFrom={redirectTarget} />
              </div>

              {/* Divider */}
              <div className="relative px-6">
                <div className="relative flex items-center">
                  <div className="flex-grow border-t border-slate-200"></div>
                  <span className="mx-4 flex-shrink text-sm text-slate-500">or</span>
                  <div className="flex-grow border-t border-slate-200"></div>
                </div>
              </div>

              {/* Guest CTA */}
              <div className="rounded-b-2xl bg-slate-50 p-6">
                <p className="mb-3 text-center text-sm text-slate-600">
                  Looking to make a reservation?
                </p>
                <a
                  href={guestSignInUrl}
                  className="flex w-full items-center justify-center rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition-all hover:border-blue-400 hover:bg-blue-50"
                >
                  Sign in as a guest →
                </a>
              </div>
            </div>

            {/* Support Link */}
            <div className="mt-6 text-center text-sm text-slate-600">
              Need help?{' '}
              <a
                href="mailto:support@sajiloreserve.com"
                className="font-medium text-blue-600 hover:text-blue-700"
              >
                Contact support
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
