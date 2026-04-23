'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { ImplicitAuthHandler } from '@/components/auth/ImplicitAuthHandler';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
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
    <ThemeProvider theme={isGuest ? 'guest' : 'app'}>
      <div
        className={cn(
          'relative min-h-[100dvh]',
          isGuest ? 'guest-theme pg-page text-foreground' : 'bg-background text-foreground',
        )}
      >
        {/* Ambient background effects */}
        {isGuest ? null : (
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(20,71,230,0.08),transparent_50%)]" />
        )}

        <ImplicitAuthHandler defaultRedirect={defaultRedirect ?? '/guest/dashboard'} />

        {/* Header/Navbar */}
        <header className="relative z-20 border-b border-border bg-background/80 backdrop-blur-md">
          <nav
            className={cn(
              'flex items-center justify-between py-4',
              isGuest ? 'pg-container' : 'mx-auto max-w-7xl px-4 sm:px-6 lg:px-8',
            )}
          >
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
                    href="/#features"
                    className="rounded-full border border-border bg-background px-4 py-2 font-medium text-foreground transition-all hover:border-primary/40 hover:bg-muted"
                  >
                    Learn more
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
          <div
            className={cn(
              'py-8',
              isGuest ? 'pg-container' : 'mx-auto max-w-7xl px-4 sm:px-6 lg:px-8',
            )}
          >
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {/* Brand Column */}
              <div className="space-y-3">
                <BrandLogo href={`/auth${searchSuffix}`} size="sm" />
                <p className="text-sm text-muted-foreground">
                  {isGuest
                    ? 'Reserve the best tables without the back-and-forth.'
                    : 'Streamline your restaurant operations with powerful booking tools.'}
                </p>
              </div>

              {/* Product Links */}
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
                      href="/#features"
                      className="text-muted-foreground transition-colors hover:text-primary"
                    >
                      Features
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/#how-it-works"
                      className="text-muted-foreground transition-colors hover:text-primary"
                    >
                      How it works
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Company Links */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Company</h3>
                <ul className="space-y-2 text-sm">
                  <li>
                    <Link
                      href="/about"
                      className="text-muted-foreground transition-colors hover:text-primary"
                    >
                      About us
                    </Link>
                  </li>
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
                      href="/partners"
                      className="text-muted-foreground transition-colors hover:text-primary"
                    >
                      Partner with us
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Legal Links */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Legal</h3>
                <ul className="space-y-2 text-sm">
                  <li>
                    <Link
                      href="/privacy"
                      className="text-muted-foreground transition-colors hover:text-primary"
                    >
                      Privacy policy
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/terms"
                      className="text-muted-foreground transition-colors hover:text-primary"
                    >
                      Terms of service
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/cookies"
                      className="text-muted-foreground transition-colors hover:text-primary"
                    >
                      Cookie policy
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
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/50 opacity-75"></span>
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
                    </span>
                    All systems operational
                  </span>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </ThemeProvider>
  );
}

export function EnhancedAuthLayout(props: EnhancedAuthLayoutProps) {
  return (
    <Suspense fallback={null}>
      <EnhancedAuthLayoutContent {...props} />
    </Suspense>
  );
}
