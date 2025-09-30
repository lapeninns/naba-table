import type { ReactNode } from "react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-base-100">
      <header className="border-b border-base-300 bg-base-200">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-4 px-6 py-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-base-content">Manage profile</h1>
            <p className="text-sm text-base-content/70">
              Update your personal details and avatar so bookings stay accurate.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              className={cn(buttonVariants({ variant: "outline", size: "primary" }), "min-w-[140px]")}
              href="/dashboard"
            >
              Back to dashboard
            </Link>
            <Link
              className={cn(buttonVariants({ variant: "primary", size: "primary" }), "min-w-[164px]")}
              href="/reserve"
            >
              New booking
            </Link>
          </div>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="container mx-auto max-w-3xl px-6 py-8 focus:outline-none">
        {children}
      </main>
    </div>
  );
}
