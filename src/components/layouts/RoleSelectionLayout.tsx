'use client';

import { Footer } from '@/components/layouts/Footer';
import { GuestBackground } from '@/components/layouts/GuestBackground';
import { GuestNavbar } from '@/components/layouts/GuestNavbar';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { cn } from '@/lib/utils';

export function RoleSelectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme="guest">
      <div className="guest-theme relative min-h-screen min-h-[100svh] bg-muted text-foreground">
        <GuestBackground />
        <div className="relative z-10 flex min-h-screen min-h-[100svh] flex-col bg-surface">
          <GuestNavbar />
          <main
            id="main-content"
            className={cn('flex flex-1 items-center justify-center py-10 sm:py-12')}
          >
            <div className="guest-boundary flex w-full justify-center">{children}</div>
          </main>
          <Footer variant="auth" />
        </div>
      </div>
    </ThemeProvider>
  );
}
