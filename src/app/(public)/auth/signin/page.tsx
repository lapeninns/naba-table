import { AlertCircle, LogIn } from 'lucide-react';
import Link from 'next/link';
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

  // Extract error info from URL params
  const errorType = resolvedParams?.error;
  const errorMessage = resolvedParams?.message;
  const hasError = !!errorType;

  // Only redirect authenticated users if there's no error
  // Using getUser() which validates the JWT with the server, not just reads cached session
  // This prevents redirect loops after logout since getSession() returns stale cached data
  if (!hasError) {
    const supabase = await getServerComponentSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    // Only redirect if we have a valid user AND no error
    if (user && !error) {
      const redirectTarget = redirectedFromParam ?? '/guest/dashboard';
      redirect(redirectTarget);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md animate-fade-in">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <LogIn className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Sign in to manage your reservations
          </p>
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
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-sm text-muted-foreground transition hover:text-foreground"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}

