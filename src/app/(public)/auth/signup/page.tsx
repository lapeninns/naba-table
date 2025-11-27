import Link from "next/link";

import { Button } from "@/components/ui/button";
import config from "@/config";

export const metadata = {
  title: "Request access · Nab a Table",
  description: "Sign-ups are invite-only. Contact support to get access.",
};

export default function SignupPlaceholderPage() {
  const supportEmail = config.email.supportEmail ?? "support@example.com";

  return (
    <div className="w-full max-w-md space-y-6 rounded-2xl border border-border bg-white p-8 text-center shadow-lg">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sign-ups are invite only</h1>
        <p className="text-sm text-muted-foreground">
          We&apos;re onboarding teams gradually. Email us and we&apos;ll set your restaurant up.
        </p>
      </div>
      <div className="space-y-3">
        <a
          href={`mailto:${supportEmail}?subject=Signup%20request`}
          className="block"
        >
          <Button className="w-full">Email {supportEmail}</Button>
        </a>
        <Link href="/auth/signin" className="block">
          <Button variant="outline" className="w-full">Back to sign in</Button>
        </Link>
      </div>
    </div>
  );
}
