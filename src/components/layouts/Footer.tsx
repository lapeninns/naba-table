'use client';

import Link from "next/link";

import { useSupabaseSession } from "@/hooks/useSupabaseSession";

type FooterVariant = "marketing" | "guest" | "app" | "auth" | "compact";

export function Footer({ variant: _variant = "marketing" }: { variant?: FooterVariant }) {
  const { status } = useSupabaseSession();
  const isAuthenticated = status === "authenticated";

  return (
    <footer className="border-t border-slate-200 bg-white/90 text-slate-700">
      <div className="guest-boundary flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-900">Nab a Table</p>
          <p className="text-xs text-slate-500">Live availability • Instant confirmation • Calendar-ready receipts</p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/restaurants" className="rounded-full border border-slate-200 px-3 py-1 hover:border-blue-500 hover:text-blue-700">
            Browse restaurants
          </Link>
          <Link href="/guest/bookings" className="rounded-full border border-slate-200 px-3 py-1 hover:border-blue-500 hover:text-blue-700">
            My bookings
          </Link>
          {!isAuthenticated ? (
            <Link href="/auth/signin" className="rounded-full border border-slate-200 px-3 py-1 hover:border-blue-500 hover:text-blue-700">
              Sign in
            </Link>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
