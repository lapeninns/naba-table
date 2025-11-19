import Link from "next/link";
import { redirect } from "next/navigation";

import { SignInForm } from "@/components/auth/SignInForm";
import { getServerComponentSupabaseClient } from "@/server/supabase";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in to operations · SajiloReserveX",
  description: "Access the restaurant operations console to manage bookings and your team.",
};

type OpsLoginSearchParams = {
  redirectedFrom?: string | string[];
};

type OpsLoginPageProps = {
  searchParams: Promise<OpsLoginSearchParams>;
};

export default async function OpsLoginPage({ searchParams }: OpsLoginPageProps) {
  const supabase = await getServerComponentSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const resolvedParams = await searchParams;
  const redirectedRaw = resolvedParams?.redirectedFrom;
  const redirectedFromParam =
    typeof redirectedRaw === "string" && redirectedRaw.startsWith("/") ? redirectedRaw : undefined;
  const redirectTarget = redirectedFromParam ?? "/";

  if (user) {
    redirect(redirectTarget);
  }

  return (
    <main className="flex min-h-screen flex-col items-center bg-slate-50 text-slate-900">
      <a
        href="#signin-form"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-slate-900 focus:shadow"
      >
        Skip to content
      </a>
      <div className="flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-10 px-6 py-16">
        <div className="space-y-3 text-center">
          <a href="https://www.sajiloreserve.com" className="text-sm font-semibold text-primary hover:underline">
            ← Back to marketing site
          </a>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Sign in to restaurant operations
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage service, confirm covers, and keep your team aligned for today’s shifts.
          </p>
        </div>
        <div className="w-full max-w-xl rounded-3xl border border-border bg-white p-8 shadow-[0_35px_70px_-45px_rgba(15,23,42,0.35)]">
          <SignInForm redirectedFrom={redirectTarget} />
        </div>
      </div>
    </main>
  );
}
