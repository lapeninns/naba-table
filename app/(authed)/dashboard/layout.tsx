import type { ReactNode } from "react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-base-100">
      <header className="border-b border-base-300 bg-base-200">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-4 px-6 py-6">
          <div>
            <h1 className="text-2xl font-semibold text-base-content">My Bookings</h1>
            <p className="text-sm text-base-content/70">
              View, edit, or cancel your upcoming reservations.
            </p>
          </div>
          <Link
            href="/reserve"
            className={cn(buttonVariants({ variant: "primary", size: "primary" }), "min-w-[164px]")}
          >
            New booking
          </Link>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="container mx-auto px-6 py-8 focus:outline-none">
        {children}
      </main>
    </div>
  );
}
