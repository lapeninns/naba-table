import { AlertCircle } from 'lucide-react';
import { redirect } from 'next/navigation';

import { OpsSignInForm } from '@/components/auth/OpsSignInForm';
import { ensureCsrfCookie } from '@/server/security/csrf';
import { getServerComponentSupabaseClient } from '@/server/supabase';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign in to operations · Nab a Table',
  description: 'Access the restaurant operations console to manage bookings and your team.',
};

type OpsLoginSearchParams = {
  redirectedFrom?: string | string[];
  error?: string;
  message?: string;
};

type OpsLoginPageProps = {
  searchParams: Promise<OpsLoginSearchParams>;
};

const ALLOWED_REDIRECT_PREFIXES = ["/app", "/guest", "/bookings", "/restaurants"] as const;

function resolveRedirectTarget(raw: string | string[] | undefined): string {
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  if (typeof candidate !== 'string' || !candidate.startsWith('/')) return '/app';

  const isAllowed = ALLOWED_REDIRECT_PREFIXES.some((prefix) =>
    candidate === prefix || candidate.startsWith(`${prefix}/`),
  );

  return isAllowed ? candidate : '/app';
}

export default async function OpsAuthSignInPage({ searchParams }: OpsLoginPageProps) {
  await ensureCsrfCookie();

  const resolvedParams = await searchParams;
  const redirectTarget = resolveRedirectTarget(resolvedParams?.redirectedFrom);

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
      redirect(redirectTarget);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center bg-slate-50 text-slate-900">
      <a
        href="#signin-form"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-slate-900 focus:shadow"
      >
        Skip to content
      </a>
      <div className="flex w-full max-w-[80vw] flex-1 flex-col items-center justify-center gap-10 px-6 py-16">
        <div className="space-y-3 text-center">
          <a href="https://www.sajiloreserve.com" className="text-sm font-semibold text-primary hover:underline">
            ← Back to marketing site
          </a>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Sign in to restaurant operations
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage service, confirm covers, and keep your team aligned for today&apos;s shifts.
          </p>
        </div>

        {/* Error Alert */}
        {hasError && errorMessage && (
          <div
            role="alert"
            className="w-full max-w-xl flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"
          >
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-500" aria-hidden="true" />
            <div className="text-sm">
              <p className="font-medium">Unable to sign in</p>
              <p className="mt-1 text-red-700">{decodeURIComponent(errorMessage)}</p>
            </div>
          </div>
        )}

        <div className="w-full max-w-xl rounded-3xl border border-border bg-white p-8 shadow-[0_35px_70px_-45px_rgba(15,23,42,0.35)]">
          <OpsSignInForm redirectedFrom={redirectTarget} />
        </div>
      </div>
    </main>
  );
}

