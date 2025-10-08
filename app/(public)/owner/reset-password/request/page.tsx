"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";

import { AuthPage } from "@/components/owner/auth/AuthPage";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { passwordResetRequestSchema, type PasswordResetRequestValues } from "@/lib/owner/auth/schema";

function PasswordResetRequestPageContent() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirectedFrom") ?? "/owner/dashboard";
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PasswordResetRequestValues>({
    resolver: zodResolver(passwordResetRequestSchema),
    defaultValues: { email: "" },
    mode: "onSubmit",
    reValidateMode: "onBlur",
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    setIsSubmitting(true);
    try {
      const redirectURL = `${window.location.origin}/owner/reset-password/update`;
      const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo: redirectURL,
      });

      if (error) {
        toast.error(error.message ?? "Unable to send reset instructions.");
        return;
      }

      toast.success("Check your email for reset instructions.");
      router.push(`/owner/reset-password/update?email=${encodeURIComponent(values.email)}&redirect=${encodeURIComponent(redirect)}`);
    } catch (error) {
      console.error("[owner/password-reset-request] unexpected", error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <AuthPage
      title="Reset your password"
      description="Enter the email tied to your owner account. We’ll send a link to set a new password."
      footer={
        <p>
          Remembered your password?{" "}
          <Link href={`/owner/sign-in${redirect ? `?redirectedFrom=${encodeURIComponent(redirect)}` : ""}`} className="text-primary underline">
            Return to sign in
          </Link>
        </p>
      }
    >
      <Form {...form}>
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <FormField
            control={form.control}
            name="email"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="owner@sajiloreserve.com"
                    aria-invalid={fieldState.invalid}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full touch-manipulation" disabled={isSubmitting} aria-live="polite">
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Send reset link
          </Button>
        </form>
      </Form>
    </AuthPage>
  );
}

export default function PasswordResetRequestPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <PasswordResetRequestPageContent />
    </Suspense>
  );
}
