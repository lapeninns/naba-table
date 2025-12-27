import { AlertCircle, LogIn } from 'lucide-react';
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
  error?: string;
  message?: string;
};

type SignInPageProps = {
  searchParams: Promise<SignInPageSearchParams>;
};

const ALLOWED_REDIRECT_PREFIXES = ['/guest', '/bookings', '/restaurants', '/app'] as const;

function resolveRedirectTarget(raw: string | string[] | undefined): string | undefined {
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  if (typeof candidate !== 'string' || !candidate.startsWith('/') || candidate.startsWith('//')) return undefined;

  const parsed = new URL(candidate, 'https://sajiloreservex.local');
  const pathname = parsed.pathname;

  const isAllowed = ALLOWED_REDIRECT_PREFIXES.some((prefix) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  return isAllowed ? candidate : undefined;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  await ensureCsrfCookie();
  const resolvedParams = await searchParams;
  const redirectedFromParam = resolveRedirectTarget(resolvedParams?.redirectedFrom);

  // Extract error info from URL params
  const errorType = resolvedParams?.error;
  const errorMessage = resolvedParams?.message;
  const hasError = !!errorType;

  // Only redirect authenticated users if there's no error
  // Using getSession() which validates the JWT, not just reads cached user
  if (!hasError) {
    const supabase = await getServerComponentSupabaseClient();
    const { data: { session }, error } = await supabase.auth.getSession();

    // Only redirect if we have a valid session AND no error
    if (session?.user && !error) {
      const redirectTarget = redirectedFromParam ?? '/guest/dashboard';
      redirect(redirectTarget);
    }
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
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xl sm:p-8">
          <GuestSignInForm redirectedFrom={redirectedFromParam} />
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

