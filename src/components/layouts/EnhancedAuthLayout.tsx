'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { ImplicitAuthHandler } from '@/components/auth/ImplicitAuthHandler';
import { Footer } from '@/components/layouts/Footer';
import { GuestBackground } from '@/components/layouts/GuestBackground';
import { GuestNavbar } from '@/components/layouts/GuestNavbar';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
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
  searchParams.toString();

  return (
    <ThemeProvider theme={isGuest ? 'guest' : 'app'}>
      <div className="guest-theme relative min-h-screen min-h-[100svh] bg-muted text-foreground">
        <GuestBackground />
        <ImplicitAuthHandler defaultRedirect={defaultRedirect ?? '/guest/dashboard'} />
        <div className="relative z-10 flex min-h-screen min-h-[100svh] flex-col bg-surface">
          <GuestNavbar />
          <main
            id="main-content"
            className={cn(
              'flex flex-1 flex-col py-8 md:py-12',
              isGuest ? undefined : 'bg-background/40',
            )}
          >
            <div className="guest-boundary flex w-full flex-1">
              <div className="w-full">{children}</div>
            </div>
          </main>
          <Footer variant={isGuest ? 'auth' : 'app'} />
        </div>
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
