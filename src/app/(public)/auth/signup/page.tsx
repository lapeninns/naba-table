import { MailPlus } from "lucide-react";
import Link from "next/link";

import { OwnerSignupForm } from "@/components/auth/OwnerSignupForm";
import { Button } from "@/components/ui/button";
import { ensureCsrfCookie } from "@/server/security/csrf";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create account · Nab a Table",
  description: "Sign up and onboard your restaurant in minutes.",
};

const featureEnabled = process.env.NEXT_PUBLIC_FEAT_ONBOARDING_WIZARD !== "false";

export default async function SignupPage() {
  await ensureCsrfCookie();

  if (!featureEnabled) {
    return (
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-border bg-white p-8 text-center shadow-lg">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sign-ups are invite only</h1>
          <p className="text-sm text-muted-foreground">
            We&apos;re onboarding teams gradually. Email us and we&apos;ll set your restaurant up.
          </p>
        </div>
        <div className="space-y-3">
          <a href="mailto:support@example.com?subject=Signup%20request" className="block">
            <Button className="w-full">Email support</Button>
          </a>
          <Link href="/auth/signin" className="block">
            <Button variant="outline" className="w-full">
              Back to sign in
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-5xl animate-fade-in">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MailPlus className="h-7 w-7" aria-hidden />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Create your restaurant account</h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Step 1 of 6 — we’ll guide you through profile, hours, service windows, and tables.
          </p>
        </div>

        <div className="flex flex-col items-center gap-6">
          <OwnerSignupForm />
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/auth/signin" className="font-semibold text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
