'use client';

import Link from 'next/link';

import { Footer } from '@/components/layouts/Footer';
import { GuestBackground } from '@/components/layouts/GuestBackground';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { BrandLogo } from '@/components/shared/BrandLogo';
import { cn } from '@/lib/utils';

function RoleSelectionNavbar() {
  return (
    <nav
      className={cn(
        'fixed left-0 top-0 z-50 w-full border-b px-6 py-3 transition-all duration-200',
        'border-border bg-background/85 shadow-[var(--pg-shadow-nav)] backdrop-blur-xl',
      )}
    >
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-center gap-2">
          <BrandLogo href="/auth" animated />
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="rounded-full px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </nav>
  );
}

export function RoleSelectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme="guest">
      <div className="guest-theme pg-page relative min-h-[100dvh] text-foreground">
        <GuestBackground />
        <div className="relative z-10 flex min-h-[100dvh] flex-col">
          <RoleSelectionNavbar />
          <main
            id="main-content"
            className="flex flex-1 items-center justify-center py-10 sm:py-12 pt-24"
          >
            <div className="guest-boundary flex w-full justify-center">{children}</div>
          </main>
          <Footer variant="auth" />
        </div>
      </div>
    </ThemeProvider>
  );
}
