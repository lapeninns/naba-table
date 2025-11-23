import { SignInForm } from "@/components/auth/SignInForm";

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
    <section id="main-content" className="w-full max-w-md px-4 py-10 sm:px-6 sm:py-12">
      <h1 className="mb-6 text-center text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
        Sign in
      </h1>
      <SignInForm redirectedFrom={redirectedFromParam} />
    </section>
  );
}
