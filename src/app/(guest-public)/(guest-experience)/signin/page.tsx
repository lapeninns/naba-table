import Link from "next/link";

import { SignInForm } from "@/components/auth/SignInForm";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { Metadata } from "next";

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
    typeof redirectedRaw === "string" && redirectedRaw.length > 0 ? redirectedRaw : undefined;

  return (
    <section tabIndex={-1} className="flex min-h-screen items-center bg-gradient-to-b from-slate-50 via-white to-slate-100 focus:outline-none">
      <a
        href="#signin-form"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-slate-900 focus:shadow"
      >
        Skip to content
      </a>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-16 sm:px-8 lg:px-10">
        <div className="space-y-3 text-left">
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            Secure access
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Sign in to {metadata.title?.toString().replace("Sign in · ", "") ?? "SajiloReserveX"}
          </h1>
          <p className="max-w-2xl text-sm text-slate-600 sm:text-base">
            Manage bookings, update your profile, and keep your reservations in sync across devices. Magic links and
            password sign-in are fully keyboard-accessible with clear focus states.
          </p>
          <Link href="/" className="inline-flex text-sm font-medium text-primary hover:underline">
            ← Back to home
          </Link>
        </div>

        <div className="grid gap-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-[1fr,1.2fr] sm:p-8">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-slate-900">Faster sign-in</h2>
            <ul className="space-y-3 text-sm text-slate-600">
              <li className="flex gap-3">
                <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-primary" aria-hidden />
                <span>Magic link or password sign-in with inline validation feedback.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-primary" aria-hidden />
                <span>Return to where you were going using the redirect hint below.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-primary" aria-hidden />
                <span>Accessible by keyboard and screen readers with focus-visible styling.</span>
              </li>
            </ul>
            <div className="flex flex-wrap gap-3">
              <a
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "touch-manipulation")}
                href="/browse"
              >
                Browse restaurants
              </a>
              <a
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "touch-manipulation")}
                href="/reserve"
              >
                Start a booking
              </a>
            </div>
          </div>

          <div id="signin-form" className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-6">
            <SignInForm redirectedFrom={redirectedFromParam} />
            <p className="mt-4 text-sm text-slate-600">
              Don’t have access yet?{" "}
              <Link href="/" className="font-medium text-primary hover:underline">
                Request an invite
              </Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
