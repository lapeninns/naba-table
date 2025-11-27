import Link from "next/link";

import { Button } from "@/components/ui/button";
import config from "@/config";

export const metadata = {
  title: "Reset password · Nab a Table",
  description: "Get help resetting your password or request a magic link.",
};

export default function ForgotPasswordPage() {
  const supportEmail = config.email.supportEmail ?? "support@example.com";

  return (
    <div className="w-full max-w-md space-y-6 rounded-2xl border border-border bg-white p-8 text-center shadow-lg">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Reset your access</h1>
        <p className="text-sm text-muted-foreground">
          Password resets are handled by our team. Email us and we&apos;ll send a secure link.
        </p>
      </div>
      <div className="space-y-3">
        <a
          href={`mailto:${supportEmail}?subject=Password%20reset%20request`}
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
