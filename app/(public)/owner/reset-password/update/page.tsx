"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";

import { AuthPage } from "@/components/owner/auth/AuthPage";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { passwordUpdateSchema, type PasswordUpdateValues } from "@/lib/owner/auth/schema";

function parseHashTokens(): { accessToken?: string; refreshToken?: string; code?: string } {
  if (typeof window === "undefined") {
    return {};
  }
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  if (!hash) {
    return {};
  }
  const params = new URLSearchParams(hash);
  const accessToken = params.get("access_token") ?? undefined;
  const refreshToken = params.get("refresh_token") ?? undefined;
  const code = params.get("code") ?? undefined;
  return { accessToken, refreshToken, code };
}

function PasswordUpdatePageContent() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const searchParams = useSearchParams();
  const router = useRouter();
  const redirect = searchParams.get("redirect") ?? "/owner/dashboard";
  const email = searchParams.get("email") ?? undefined;

  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const ensureSession = async () => {
      try {
        const hashTokens = parseHashTokens();
        const code = searchParams.get("code") ?? hashTokens.code;
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            throw error;
          }
        } else if (hashTokens.accessToken && hashTokens.refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: hashTokens.accessToken,
            refresh_token: hashTokens.refreshToken,
          });
          if (error) {
            throw error;
          }
        } else {
          throw new Error("Missing recovery code. Request a new reset link.");
        }

        if (!isMounted) return;
        setSessionReady(true);
      } catch (error) {
        console.error("[owner/password-update] session error", error);
        if (!isMounted) return;
        setSessionError(error instanceof Error ? error.message : "Unable to validate your reset link.");
      }
    };

    void ensureSession();

    return () => {
      isMounted = false;
    };
  }, [searchParams, supabase]);

  const form = useForm<PasswordUpdateValues>({
    resolver: zodResolver(passwordUpdateSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
    mode: "onSubmit",
    reValidateMode: "onBlur",
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: values.password });
      if (error) {
        toast.error(error.message ?? "Unable to update your password");
        return;
      }
      toast.success("Password updated successfully.");
      router.push(`/owner/sign-in?redirectedFrom=${encodeURIComponent(redirect)}`);
    } catch (error) {
      console.error("[owner/password-update] unexpected", error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  });

  const disabled = !sessionReady || Boolean(sessionError);

  return (
    <AuthPage
      title="Choose a new password"
      description={
        sessionError
          ? sessionError
          : "Enter a strong password you haven’t used on SajiloReserveX before."
      }
      footer={
        <p>
          Remembered your password?{" "}
          <Link href={`/owner/sign-in?redirectedFrom=${encodeURIComponent(redirect)}`} className="text-primary underline">
            Return to sign in
          </Link>
        </p>
      }
    >
      <Form {...form}>
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <FormField
            control={form.control}
            name="password"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>New password</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="password"
                    autoComplete="new-password"
                    placeholder="Enter a new password"
                    aria-invalid={fieldState.invalid}
                    disabled={disabled}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>Confirm new password</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="password"
                    autoComplete="new-password"
                    placeholder="Re-enter your new password"
                    aria-invalid={fieldState.invalid}
                    disabled={disabled}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full touch-manipulation" disabled={disabled || isSubmitting} aria-live="polite">
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Save new password
          </Button>
        </form>
      </Form>

      {email ? <p className="mt-4 text-center text-sm text-muted-foreground">Resetting password for {email}</p> : null}
    </AuthPage>
  );
}

export default function PasswordUpdatePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <PasswordUpdatePageContent />
    </Suspense>
  );
}
