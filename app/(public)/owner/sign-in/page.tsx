"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { SignInForm } from "@/components/auth/SignInForm";
import { AuthPage } from "@/components/owner/auth/AuthPage";

function OwnerSignInInner() {
  const searchParams = useSearchParams();
  const redirectedFromParam = searchParams.get("redirectedFrom");
  const redirectTarget =
    redirectedFromParam && redirectedFromParam.startsWith("/")
      ? redirectedFromParam
      : "/owner/dashboard";

  return (
    <AuthPage
      title="Sign in to your owner account"
      description="Request a magic link to access your restaurant console."
      footer={
        <p>
          Need access?{" "}
          <Link href="/" className="text-primary underline">
            Contact our team
          </Link>
        </p>
      }
    >
      <SignInForm redirectedFrom={redirectTarget} />
    </AuthPage>
  );
}

export default function OwnerSignInPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <OwnerSignInInner />
    </Suspense>
  );
}
