'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { isFocusedBookingFlowPath } from '@/components/layouts/publicRouteChrome';
import { BrandLogo } from '@/components/shared/BrandLogo';
import { useSupabaseSession } from '@/hooks/useSupabaseSession';

type FooterVariant = 'marketing' | 'guest' | 'app' | 'auth' | 'compact';

export function Footer({ variant: _variant = 'marketing' }: { variant?: FooterVariant }) {
  const { status } = useSupabaseSession();
  const isAuthenticated = status === 'authenticated';
  const pathname = usePathname();

  if (isFocusedBookingFlowPath(pathname)) {
    return null;
  }

  return (
    <footer className="border-t border-border/70 bg-background/80 text-foreground backdrop-blur supports-[backdrop-filter]:saturate-150">
      <div className="pg-container flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <BrandLogo size="sm" showBeta={false} />
          <p className="pg-caption">Live availability · Instant confirmation · Guest receipts</p>
        </div>
        <nav aria-label="Footer navigation" className="flex flex-wrap gap-3 text-sm">
          <Link
            href="/restaurants"
            className="rounded-full border border-border px-3 py-1 transition-colors hover:border-primary/40 hover:text-primary"
          >
            Browse restaurants
          </Link>
          <Link
            href="/bookings"
            className="rounded-full border border-border px-3 py-1 transition-colors hover:border-primary/40 hover:text-primary"
          >
            Book a table
          </Link>
          {isAuthenticated ? (
            <Link
              href="/guest/bookings"
              className="rounded-full border border-border px-3 py-1 transition-colors hover:border-primary/40 hover:text-primary"
            >
              My bookings
            </Link>
          ) : null}
          {!isAuthenticated ? (
            <Link
              href="/auth/signin"
              className="rounded-full border border-border px-3 py-1 transition-colors hover:border-primary/40 hover:text-primary"
            >
              Sign in
            </Link>
          ) : null}
        </nav>
      </div>

      {/* Separator */}
      <div className="pg-container">
        <hr className="border-border/40" />
      </div>

      {/* Bottom row */}
      <div className="pg-container flex flex-col gap-2 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>&copy; {new Date().getFullYear()} Nab a Table. All rights reserved.</p>
        <nav aria-label="Legal links" className="flex gap-4">
          <Link href="/privacy" className="transition-colors hover:text-primary">
            Privacy Policy
          </Link>
          <Link href="/contact" className="transition-colors hover:text-primary">
            Support
          </Link>
        </nav>
      </div>
    </footer>
  );
}
