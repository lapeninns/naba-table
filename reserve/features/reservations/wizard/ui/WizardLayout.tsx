'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

interface WizardLayoutProps {
  heroRef?: React.RefObject<HTMLSpanElement>;
  stickyHeight?: number;
  stickyVisible?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function WizardLayout({
  heroRef,
  stickyHeight = 0,
  stickyVisible = false,
  children,
  footer,
}: WizardLayoutProps) {
  const mainStyle = stickyVisible
    ? {
        paddingBottom: `calc(${stickyHeight}px + env(safe-area-inset-bottom, 0px) + 1.5rem)`,
      }
    : undefined;

  return (
    <>
      <main
        style={mainStyle}
        className={cn(
          'min-h-screen w-full bg-slate-50 px-4 pb-24 pt-10 font-sans text-srx-ink-strong transition-[padding-bottom] duration-fast sm:pt-16 md:px-6 lg:px-10',
        )}
      >
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 sm:gap-12">
          <span ref={heroRef} aria-hidden className="block h-px w-full" />
          {children}
        </div>
      </main>
      {footer}
    </>
  );
}
