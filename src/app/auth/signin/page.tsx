import { LogIn } from 'lucide-react';
import Link from 'next/link';

import { SignInForm } from '@/components/auth/SignInForm';
import { ensureCsrfCookie } from '@/server/security/csrf';

import type { Metadata } from 'next';


export const metadata: Metadata = {
  title: 'Sign in · Nab a Table',
  description: 'Access your Nab a Table account to manage bookings and settings.',
};

type SignInPageSearchParams = {
  redirectedFrom?: string | string[];
};

type SignInPageProps = {
  searchParams: Promise<SignInPageSearchParams>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const resolvedParams = await searchParams;
  const redirectedRaw = resolvedParams?.redirectedFrom;
  const redirectedFromParam =
    typeof redirectedRaw === 'string' && redirectedRaw.length > 0 ? redirectedRaw : undefined;

  ensureCsrfCookie();

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

        {/* Sign-in Card */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xl sm:p-8">
          <SignInForm redirectedFrom={redirectedFromParam} />
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
