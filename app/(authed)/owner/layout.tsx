import type { ReactNode } from 'react';
import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type OwnerLayoutProps = {
  children: ReactNode;
};

export default function OwnerLayout({ children }: OwnerLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <a
        href="#owner-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <header className="border-b border-border bg-muted/40">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-4 px-6 py-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-foreground">Restaurant Console</h1>
            <p className="text-sm text-muted-foreground">
              Monitor service, manage guest bookings, and keep your front-of-house in sync.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/owner/console"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'min-w-[148px]')}
            >
              Today&apos;s bookings
            </Link>
            <Link
              href="/reserve"
              className={cn(buttonVariants({ variant: 'default', size: 'sm' }), 'min-w-[148px]')}
            >
              New booking
            </Link>
          </div>
        </div>
      </header>
      <main
        id="owner-main"
        tabIndex={-1}
        className="container mx-auto px-6 pb-12 pt-8 focus:outline-none"
      >
        {children}
      </main>
    </div>
  );
}
