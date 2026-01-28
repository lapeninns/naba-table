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
        'fixed top-0 left-0 w-full z-50 px-6 transition-all duration-200 border-b',
        'bg-white/90 backdrop-blur-md py-3 border-slate-200 shadow-sm',
      )}
    >
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-center gap-2">
          <BrandLogo href="/auth" animated />
        </div>
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm font-semibold text-slate-600 hover:text-slate-900">
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
      <div className="guest-theme relative min-h-screen min-h-[100svh] bg-muted text-foreground">
        <GuestBackground />
        <div className="relative z-10 flex min-h-screen min-h-[100svh] flex-col bg-surface">
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
