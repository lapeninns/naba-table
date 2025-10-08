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
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { signUpSchema, type SignUpValues } from "@/lib/owner/auth/schema";

function OwnerSignUpPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectedFrom") ?? "/owner/dashboard";
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
    },
    mode: "onSubmit",
    reValidateMode: "onBlur",
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    setIsSubmitting(true);
    try {
      const redirectURL = `${window.location.origin}/api/auth/callback`;
      const phone = values.phone ? values.phone.trim() : "";
      const { error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          emailRedirectTo: redirectURL,
          data: {
            full_name: values.name,
            phone_number: phone.length > 0 ? phone : undefined,
          },
        },
      });

      if (error) {
        if (error.code === "user_already_exists") {
          form.setError("email", { message: "An account with this email already exists" });
          return;
        }
        toast.error(error.message ?? "We couldn’t complete your sign up.");
        return;
      }

      toast.success("Check your inbox to verify your email.");
      router.push(`/owner/verify-email?email=${encodeURIComponent(values.email)}&redirect=${encodeURIComponent(redirectTo)}`);
    } catch (error) {
      console.error("[owner/sign-up] unexpected", error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <AuthPage
      title="Create your owner account"
      description="Sign up to start managing your restaurant with SajiloReserveX."
      footer={
        <p>
          Already have an account?{" "}
          <Link href={`/owner/sign-in${redirectTo ? `?redirectedFrom=${encodeURIComponent(redirectTo)}` : ""}`} className="text-primary underline">
            Sign in
          </Link>
        </p>
      }
    >
      <Form {...form}>
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <FormField
            control={form.control}
            name="name"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>Full name</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Sajilo Owner" autoComplete="name" aria-invalid={fieldState.invalid} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

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
            name="phone"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>Phone (optional)</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="+977 980-0000000"
                    aria-invalid={fieldState.invalid}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="password"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      autoComplete="new-password"
                      placeholder="Enter a secure password"
                      aria-invalid={fieldState.invalid}
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
                  <FormLabel>Confirm password</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      autoComplete="new-password"
                      placeholder="Re-enter your password"
                      aria-invalid={fieldState.invalid}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Button
            type="submit"
            className="w-full touch-manipulation"
            disabled={isSubmitting}
            aria-live="polite"
          >
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Create account
          </Button>
        </form>
      </Form>
    </AuthPage>
  );
}

export default function OwnerSignUpPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <OwnerSignUpPageContent />
    </Suspense>
  );
}
