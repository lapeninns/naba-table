import { ChevronLeft, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { GuestSignInForm } from '@/components/auth/GuestSignInForm';
import { BrandIcon } from '@/components/shared/BrandIcon';
import { ensureCsrfCookie } from '@/server/security/csrf';
import { getServerComponentSupabaseClient } from '@/server/supabase';

import type { Metadata } from 'next';


export const metadata: Metadata = {
  title: 'Sign in · Nab a Table',
  description: 'Access your Nab a Table guest account to manage bookings and settings.',
};

type SignInPageSearchParams = {
  redirectedFrom?: string | string[];
};

type SignInPageProps = {
  searchParams: Promise<SignInPageSearchParams>;
};

const ALLOWED_REDIRECT_PREFIXES = ["/guest", "/bookings", "/restaurants", "/app"] as const;

function resolveRedirectTarget(raw: string | string[] | undefined): string | undefined {
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  if (typeof candidate !== 'string' || !candidate.startsWith('/')) return undefined;

  const isAllowed = ALLOWED_REDIRECT_PREFIXES.some((prefix) =>
    candidate === prefix || candidate.startsWith(`${prefix}/`),
  );

  return isAllowed ? candidate : undefined;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  await ensureCsrfCookie();
  const resolvedParams = await searchParams;
  const redirectedFromParam = resolveRedirectTarget(resolvedParams?.redirectedFrom);

  // Redirect authenticated users to their intended destination or dashboard
  const supabase = await getServerComponentSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const redirectTarget = redirectedFromParam ?? '/guest/dashboard';
    redirect(redirectTarget);
  }

  return (
    <div className="w-full max-w-md animate-fade-up">
      {/* Brand Header */}
      <div className="mb-8 text-center">
        <div className="relative mx-auto mb-5">
          {/* Outer glow */}
          <div className="absolute inset-0 -m-2 rounded-full bg-gradient-to-br from-blue-100 to-violet-100 blur-2xl opacity-50" />

          {/* Icon container */}
          <BrandIcon size="lg" className="relative mx-auto shadow-xl shadow-slate-900/20" />

          {/* Sparkle decoration */}
          <div className="absolute -right-1 -top-1 animate-bounce" style={{ animationDelay: '0.2s', animationDuration: '2s' }}>
            <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-amber-400" />
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
          Welcome back
        </h1>
        <p className="mt-2 text-sm sm:text-base text-slate-500">
          Sign in to manage your reservations.
        </p>
      </div>

      {/* Sign-in Card */}
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white/90 shadow-xl backdrop-blur-sm">
        <GuestSignInForm redirectedFrom={redirectedFromParam} />
      </div>

      {/* Footer Links */}
      <div className="mt-6 space-y-3 text-center">
        {/* Restaurant Login Link */}
        <div className="rounded-xl border border-slate-100 bg-white/70 px-5 py-3 backdrop-blur-sm shadow-sm">
          <p className="text-xs sm:text-sm text-slate-500">Restaurant owner?</p>
          <Link
            href="/app/auth/signin"
            className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-slate-900 hover:text-slate-700 transition-colors"
          >
            Sign in to operations
            <ChevronLeft className="h-4 w-4 rotate-180" />
          </Link>
        </div>

        {/* Back to Home */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to home
        </Link>
      </div>
    </div>
  );
}
