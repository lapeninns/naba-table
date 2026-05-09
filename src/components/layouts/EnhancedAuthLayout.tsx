'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { ImplicitAuthHandler } from '@/components/auth/ImplicitAuthHandler';
import { BrandLogo } from '@/components/shared/BrandLogo';
import { cn } from '@/lib/utils';

type EnhancedAuthLayoutProps = {
  children: React.ReactNode;
  variant: 'guest' | 'restaurant';
  defaultRedirect?: string;
};

function EnhancedAuthLayoutContent({
  children,
  variant,
  defaultRedirect,
}: EnhancedAuthLayoutProps) {
  const isGuest = variant === 'guest';
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const searchSuffix = queryString ? `?${queryString}` : '';

  return (
    <div
      className={cn(
        'relative min-h-[100dvh]',
        isGuest ? 'guest-theme pg-page text-foreground' : 'bg-background text-foreground',
      )}
    >
      {/* Ambient background effects */}
      {isGuest ? null : <div className="pg-auth-ambient pointer-events-none absolute inset-0" />}

      <ImplicitAuthHandler defaultRedirect={defaultRedirect ?? '/guest/dashboard'} />

      {/* Header/Navbar */}
      <header className="relative z-20 border-b border-border bg-background/80 backdrop-blur-md">
        <nav className={cn('flex items-center justify-between py-4 pg-container')}>
          <BrandLogo href={`/auth${searchSuffix}`} animated />

          <div className="flex items-center gap-4 text-sm">
            {isGuest ? (
              <>
                <Link
                  href={`/app/auth/signin${searchSuffix}`}
                  className="hidden text-muted-foreground transition-colors hover:text-foreground sm:block"
                >
                  Restaurant owners
                </Link>
                <Link
                  href="/restaurants"
                  className="rounded-full border border-border bg-background px-4 py-2 font-medium text-foreground transition-all hover:border-primary/40 hover:bg-muted"
                >
                  Browse tables
                </Link>
              </>
            ) : (
              <>
                <Link
                  href={`/auth/signin${searchSuffix}`}
                  className="hidden text-muted-foreground transition-colors hover:text-foreground sm:block"
                >
                  Guest sign-in
                </Link>
                <Link
                  href="/#restaurants"
                  className="rounded-full border border-border bg-background px-4 py-2 font-medium text-foreground transition-all hover:border-primary/40 hover:bg-muted"
                >
                  View demo
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main id="main-content" className="relative z-10 flex flex-1 flex-col">
        {children}
      </main>

      {/* Footer */}
      <footer className="relative z-20 border-t border-border bg-background/80 backdrop-blur-md">
        <div className={cn('py-8 pg-container')}>
          <div className="grid gap-8 sm:grid-cols-[1.4fr_1fr_1fr]">
            <div className="space-y-3">
              <BrandLogo href={`/auth${searchSuffix}`} size="sm" />
              <p className="text-sm text-muted-foreground">
                {isGuest
                  ? 'Reserve the best tables without the back-and-forth.'
                  : 'Streamline your restaurant operations with powerful booking tools.'}
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Product</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link
                    href="/restaurants"
                    className="text-muted-foreground transition-colors hover:text-primary"
                  >
                    Browse restaurants
                  </Link>
                </li>
                <li>
                  <Link
                    href="/bookings"
                    className="text-muted-foreground transition-colors hover:text-primary"
                  >
                    Booking hub
                  </Link>
                </li>
                <li>
                  <Link
                    href="/auth/signin"
                    className="text-muted-foreground transition-colors hover:text-primary"
                  >
                    Guest sign-in
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Help</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link
                    href="/contact"
                    className="text-muted-foreground transition-colors hover:text-primary"
                  >
                    Contact
                  </Link>
                </li>
                <li>
                  <Link
                    href="/privacy"
                    className="text-muted-foreground transition-colors hover:text-primary"
                  >
                    Privacy policy
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="mt-8 border-t border-border pt-6">
            <div className="flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
              <p>© {new Date().getFullYear()} Nab a Table. All rights reserved.</p>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-2">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/50 opacity-75"></span>
                    <span className="relative inline-flex size-2 rounded-full bg-primary"></span>
                  </span>
                  All systems operational
                </span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function EnhancedAuthLayout(props: EnhancedAuthLayoutProps) {
  return (
    <Suspense fallback={null}>
      <EnhancedAuthLayoutContent {...props} />
    </Suspense>
  );
}
