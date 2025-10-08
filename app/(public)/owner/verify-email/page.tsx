"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Loader2, MailCheck, RefreshCcw } from "lucide-react";
import { toast } from "react-hot-toast";

import { AuthPage } from "@/components/owner/auth/AuthPage";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const RESEND_INTERVAL_MS = 30_000;

function VerifyEmailPageContent() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get("email");
  const redirect = searchParams.get("redirect") ?? "/owner/dashboard";

  const [isResending, setIsResending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [nextResendAt, setNextResendAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  const canResend = !nextResendAt || now >= nextResendAt;
  const secondsLeft = nextResendAt ? Math.max(0, Math.ceil((nextResendAt - now) / 1000)) : 0;

  const handleResend = async () => {
    if (!email) {
      toast.error("We need your email address to resend the verification link.");
      return;
    }

    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
      });
      if (error) {
        toast.error(error.message ?? "Unable to resend verification email");
        return;
      }
      toast.success("Verification email sent.");
      setNextResendAt(Date.now() + RESEND_INTERVAL_MS);
    } catch (error) {
      console.error("[owner/verify-email] resend failed", error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  const handleCheckStatus = async () => {
    setIsChecking(true);
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        toast.error(error.message ?? "Unable to refresh your session");
        return;
      }
      if (data.user?.email_confirmed_at) {
        toast.success("Email verified! Redirecting you now.");
        router.push(redirect);
        router.refresh();
        return;
      }
      toast.error("We haven’t detected a verified email yet. Try again in a moment.");
    } catch (error) {
      console.error("[owner/verify-email] check failed", error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <AuthPage
      title="Confirm your email"
      description={
        email
          ? `We sent a verification link to ${email}. Click the link in your inbox, then return here to continue.`
          : "We sent a verification link to your inbox. Click it and then confirm below."
      }
      footer={
        <p>
          Wrong email?{" "}
          <Link href="/owner/sign-up" className="text-primary underline">
            Start over
          </Link>
        </p>
      }
    >
      <div className="space-y-6">
        <div className="flex items-center gap-3 rounded-lg border border-primary/40 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
          <MailCheck className="h-5 w-5 text-primary" aria-hidden="true" />
          <p className="leading-6">
            Didn’t see the email? Check your spam or promotions folder. You can also resend the verification email below.
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <Button
            type="button"
            className="flex-1 touch-manipulation"
            disabled={isChecking}
            onClick={handleCheckStatus}
          >
            {isChecking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            I’ve verified my email
          </Button>

          <Button
            type="button"
            variant="outline"
            className="flex-1 touch-manipulation"
            disabled={isResending || !canResend}
            onClick={handleResend}
          >
            {isResending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCcw className="mr-2 h-4 w-4" aria-hidden="true" />}
            Resend email
            {!canResend && secondsLeft > 0 ? <span className="ml-2 text-xs text-muted-foreground">({secondsLeft}s)</span> : null}
          </Button>
        </div>
      </div>
    </AuthPage>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <VerifyEmailPageContent />
    </Suspense>
  );
}
