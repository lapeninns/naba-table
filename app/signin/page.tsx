import type { Metadata } from "next";
import Link from "next/link";

import { SignInForm } from "@/components/auth/SignInForm";

export const metadata: Metadata = {
  title: "Sign in · SajiloReserveX",
  description: "Access your SajiloReserveX account to manage bookings and settings.",
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
    typeof redirectedRaw === "string" && redirectedRaw.length > 0
      ? redirectedRaw
      : undefined;

  return (
    <main className="flex min-h-screen flex-col items-center bg-slate-50">
      <a
        href="#signin-form"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-slate-900 focus:shadow"
      >
        Skip to content
      </a>
      <div className="flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-10 px-6 py-16">
        <div className="space-y-3 text-center">
          <Link href="/" className="text-sm font-semibold text-primary hover:underline">
            ← Back to home
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Sign in to SajiloReserveX
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage bookings, update restaurant settings, and keep your guests informed.
          </p>
        </div>
        <SignInForm redirectedFrom={redirectedFromParam} />
        <p className="text-sm text-muted-foreground">
          Don’t have access yet?{' '}
          <Link href="/" className="font-medium text-primary hover:underline">
            Request an invite
          </Link>
        </p>
      </div>
    </main>
  );
}
