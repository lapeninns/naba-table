'use client';

import * as React from 'react';

import { cn } from '@shared/lib/cn';

export type WizardHeroRef =
  | React.RefObject<HTMLSpanElement | null>
  | React.MutableRefObject<HTMLSpanElement | null>;

interface WizardLayoutProps {
  heroRef?: WizardHeroRef;
  stickyHeight?: number;
  stickyVisible?: boolean;
  /** Restaurant name to display at the top */
  restaurantName?: string;
  banner?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  elementType?: 'main' | 'div';
  className?: string;
  contentClassName?: string;
}

export function WizardLayout({
  heroRef,
  stickyHeight = 0,
  stickyVisible = false,
  restaurantName,
  banner,
  children,
  footer,
  elementType = 'main',
  className,
  contentClassName,
}: WizardLayoutProps) {
  const mainStyle = stickyVisible
    ? {
        paddingBottom: `calc(${stickyHeight}px + env(safe-area-inset-bottom, 0px) + 1rem)`,
      }
    : undefined;

  const Container = elementType === 'div' ? 'div' : 'main';

  return (
    <>
      <Container
        style={mainStyle}
        className={cn(
          // Reduced vertical padding for tighter layout
          'min-h-screen w-full',
          'bg-gradient-to-b from-blue-50/50 via-white to-white',
          'px-4 pb-20 pt-4',
          'sm:pt-6 md:px-6 lg:px-8',
          'font-sans text-foreground',
          'transition-[padding-bottom] duration-200',
          className,
        )}
      >
        <div
          className={cn(
            // Tighter max-width and reduced gaps
            'mx-auto flex w-full max-w-4xl flex-col gap-4 sm:gap-6',
            contentClassName,
          )}
        >
          <span ref={heroRef} aria-hidden className="block h-px w-full" />

          {/* Restaurant header */}
          {restaurantName && (
            <header className="text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground sm:text-sm">
                Book at
              </p>
              <h1 className="text-xl font-bold text-foreground sm:text-2xl">{restaurantName}</h1>
            </header>
          )}

          {banner ? <div>{banner}</div> : null}
          {children}
        </div>
      </Container>
      {footer}
    </>
  );
}
