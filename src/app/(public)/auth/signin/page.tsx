import { AlertCircle, Sparkles, Shield, Zap, Clock } from 'lucide-react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { GuestSignInForm } from '@/components/auth/GuestSignInForm';
import { ensureCsrfCookie } from '@/server/security/csrf';
import { getServerComponentSupabaseClient } from '@/server/supabase';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign in · Nab a Table',
  description: 'Access your Nab a Table guest account to manage bookings and settings.',
};

type SignInPageSearchParams = {
  redirectedFrom?: string | string[];
  error?: string;
  message?: string;
};

type SignInPageProps = {
  searchParams: Promise<SignInPageSearchParams>;
};

const ALLOWED_REDIRECT_PREFIXES = ['/guest', '/bookings', '/restaurants', '/app'] as const;
const OPS_REDIRECT_PREFIXES = [
  '/app',
  '/dashboard',
  '/bookings',
  '/customers',
  '/seating',
  '/settings',
  '/management',
  '/new-bookings',
] as const;

function resolveRedirectTarget(raw: string | string[] | undefined): string | undefined {
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  if (typeof candidate !== 'string' || !candidate.startsWith('/') || candidate.startsWith('//'))
    return undefined;

  const parsed = new URL(candidate, 'https://sajiloreservex.local');
  const pathname = parsed.pathname;

  const isAllowed = ALLOWED_REDIRECT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  return isAllowed ? candidate : undefined;
}

function resolveOpsRedirectTarget(raw: string | string[] | undefined): string | undefined {
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  if (typeof candidate !== 'string' || !candidate.startsWith('/') || candidate.startsWith('//'))
    return undefined;

  const parsed = new URL(candidate, 'https://sajiloreservex.local');
  const pathname = parsed.pathname;

  const isAllowed = OPS_REDIRECT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  return isAllowed ? candidate : undefined;
}

function isOpsRedirectTarget(target: string | undefined): boolean {
  if (!target) return false;
  return OPS_REDIRECT_PREFIXES.some(
    (prefix) => target === prefix || target.startsWith(`${prefix}/`),
  );
}

function isAppHost(hostname: string, rootDomain: string): boolean {
  if (!hostname) return false;
  const normalizedHost = hostname.toLowerCase();
  const normalizedRoot = rootDomain.toLowerCase().replace(/^www\./, '');
  if (normalizedRoot === 'localhost') {
    return normalizedHost.startsWith('app.localhost');
  }
  return normalizedHost === `app.${normalizedRoot}`;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  await ensureCsrfCookie();
  const headersList = await headers();
  const hostHeader = headersList.get('host') ?? '';
  const hostname = hostHeader.replace(/:\d+$/, '');
  const hostPort = hostHeader.includes(':') ? hostHeader.split(':').pop() : undefined;
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost';
  const resolvedParams = await searchParams;
  const redirectedFromParam = resolveRedirectTarget(resolvedParams?.redirectedFrom);
  const opsRedirectedFromParam = resolveOpsRedirectTarget(resolvedParams?.redirectedFrom);

  // Build restaurant sign-in URL for cross-subdomain navigation
  const restaurantSignInUrlBase =
    rootDomain === 'localhost'
      ? `http://app.localhost${hostPort ? `:${hostPort}` : ''}/auth/signin`
      : `https://app.${rootDomain.toLowerCase().replace(/^www\./, '')}/auth/signin`;

  const restaurantSignInUrlObj = new URL(restaurantSignInUrlBase);
  if (resolvedParams?.redirectedFrom) {
    const rawParam = Array.isArray(resolvedParams.redirectedFrom)
      ? resolvedParams.redirectedFrom[0]
      : resolvedParams.redirectedFrom;
    restaurantSignInUrlObj.searchParams.set('redirectedFrom', rawParam);
  }
  const restaurantSignInUrl = restaurantSignInUrlObj.toString();

  if (!isAppHost(hostname, rootDomain) && isOpsRedirectTarget(opsRedirectedFromParam)) {
    const appHost =
      rootDomain === 'localhost'
        ? `app.localhost${hostPort ? `:${hostPort}` : ''}`
        : `app.${rootDomain.toLowerCase().replace(/^www\./, '')}`;
    const targetUrl = new URL('/auth/signin', `http://${appHost}`);
    if (rootDomain !== 'localhost') {
      targetUrl.protocol = 'https:';
    }
    if (opsRedirectedFromParam) {
      targetUrl.searchParams.set('redirectedFrom', opsRedirectedFromParam);
    }
    if (resolvedParams?.error) {
      targetUrl.searchParams.set('error', resolvedParams.error);
    }
    if (resolvedParams?.message) {
      targetUrl.searchParams.set('message', resolvedParams.message);
    }
    redirect(targetUrl.toString());
  }

  // Extract error info from URL params
  const errorType = resolvedParams?.error;
  const errorMessage = resolvedParams?.message;
  const hasError = !!errorType;

  // Only redirect authenticated users if there's no error
  // Using getSession() which validates the JWT, not just reads cached user
  if (!hasError) {
    const supabase = await getServerComponentSupabaseClient();
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    // Only redirect if we have a valid session AND no error
    if (session?.user && !error) {
      const redirectTarget = redirectedFromParam ?? '/guest/dashboard';
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
                <Sparkles className="h-4 w-4" />
                Seamless dining experiences
              </div>

              <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                Welcome back to effortless dining
              </h1>

              <p className="text-lg text-slate-600">
                Sign in to manage your reservations, discover new restaurants, and enjoy instant
                confirmations—all from one place.
              </p>
            </div>

            {/* Benefits Grid */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3.5">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100">
                  <Zap className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Instant confirmation</h3>
                  <p className="text-xs text-slate-600">Book and get confirmed in seconds</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3.5">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-green-100">
                  <Clock className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Easy changes</h3>
                  <p className="text-xs text-slate-600">Modify or cancel anytime</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3.5">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-purple-100">
                  <Shield className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Secure & private</h3>
                  <p className="text-xs text-slate-600">Data protected and never shared</p>
                </div>
              </div>
            </div>

            {/* Social Proof */}
            <div className="flex items-center justify-around rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-center">
                <div className="text-xl font-bold text-slate-900">50K+</div>
                <div className="text-xs text-slate-600">Diners</div>
              </div>
              <div className="h-8 w-px bg-slate-300" />
              <div className="text-center">
                <div className="text-xl font-bold text-slate-900">200+</div>
                <div className="text-xs text-slate-600">Restaurants</div>
              </div>
              <div className="h-8 w-px bg-slate-300" />
              <div className="text-center">
                <div className="text-xl font-bold text-slate-900">4.9★</div>
                <div className="text-xs text-slate-600">Rating</div>
              </div>
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
                  <p className="mt-1 text-red-700">{decodeURIComponent(errorMessage)}</p>
                </div>
              </div>
            )}

            {/* Sign-in Card */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-xl">
              <div className="p-6 sm:p-8">
                <GuestSignInForm redirectedFrom={redirectedFromParam} />
              </div>

              {/* Divider */}
              <div className="relative px-6 pb-6">
                <div className="relative flex items-center">
                  <div className="flex-grow border-t border-slate-200"></div>
                  <span className="mx-4 flex-shrink text-sm text-slate-500">or</span>
                  <div className="flex-grow border-t border-slate-200"></div>
                </div>
              </div>

              {/* Restaurant Owner CTA */}
              <div className="rounded-b-2xl bg-slate-50 px-6 pb-6">
                <p className="mb-3 text-center text-sm text-slate-600">
                  Are you a restaurant owner?
                </p>
                <a
                  href={restaurantSignInUrl}
                  className="flex w-full items-center justify-center rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition-all hover:border-blue-400 hover:bg-blue-50"
                >
                  Sign in to operations console →
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
