"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";

import { AuthPage } from "@/components/owner/auth/AuthPage";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import config from "@/config";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { signInSchema, type SignInValues } from "@/lib/owner/auth/schema";

function OwnerSignInPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectedFrom") ?? "/owner/dashboard";
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
    mode: "onSubmit",
    reValidateMode: "onBlur",
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (error) {
        if (error.code === "invalid_credentials") {
          form.setError("password", { message: "Incorrect email or password" });
          return;
        }
        if (error.code === "email_not_confirmed") {
          toast.error("Verify your email address before signing in.");
          router.push(`/owner/verify-email?email=${encodeURIComponent(values.email)}&redirect=${encodeURIComponent(redirectTo)}`);
          return;
        }
        toast.error(error.message ?? "Unable to sign in. Please try again.");
        return;
      }

      if (!data.session) {
        toast.error("We could not establish a session. Please try again.");
        return;
      }

      toast.success("Welcome back!");
      router.push(redirectTo || config.auth.callbackUrl || "/");
      router.refresh();
    } catch (error) {
      console.error("[owner/sign-in] unexpected", error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <AuthPage
      title="Sign in to your owner account"
      description="Access your restaurant console to manage bookings and settings."
      footer={
        <p>
          Don’t have an account?{" "}
          <Link href={`/owner/sign-up${redirectTo ? `?redirectedFrom=${encodeURIComponent(redirectTo)}` : ""}`} className="text-primary underline">
            Create one
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

          <FormField
            control={form.control}
            name="password"
            render={({ field, fieldState }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>Password</FormLabel>
                  <Link href={`/owner/reset-password/request${redirectTo ? `?redirectedFrom=${encodeURIComponent(redirectTo)}` : ""}`} className="text-sm text-primary underline">
                    Forgot password?
                  </Link>
                </div>
                <FormControl>
                  <Input
                    {...field}
                    type="password"
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    aria-invalid={fieldState.invalid}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full touch-manipulation" disabled={isSubmitting} aria-live="polite">
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Sign in
          </Button>
        </form>
      </Form>
    </AuthPage>
  );
}

export default function OwnerSignInPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <OwnerSignInPageContent />
    </Suspense>
  );
}
