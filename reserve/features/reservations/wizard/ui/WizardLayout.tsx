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
  stickyHeight: _stickyHeight = 0,
  stickyVisible: _stickyVisible = false,
  restaurantName,
  banner,
  children,
  footer,
  elementType = 'main',
  className,
  contentClassName,
}: WizardLayoutProps) {
  const Container = elementType === 'div' ? 'div' : 'main';

  return (
    <>
      <Container
        className={cn(
          'w-full',
          'bg-transparent',
          'px-4 pb-12 pt-4',
          'sm:pb-14 sm:pt-6 md:px-6 lg:px-8',
          'font-sans text-foreground',
          className,
        )}
      >
        <div
          className={cn('mx-auto flex w-full max-w-6xl flex-col gap-6 sm:gap-8', contentClassName)}
        >
          <span ref={heroRef} aria-hidden className="block h-px w-full" />

          {/* Restaurant header */}
          {restaurantName && (
            <header className="luminous-panel relative overflow-hidden grid gap-5 px-5 py-6 sm:gap-6 sm:px-8 sm:py-8 md:grid-cols-[minmax(0,1.35fr)_auto] md:items-end lg:px-10 lg:py-10">
              <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top_left,rgba(0,86,210,0.16),transparent_52%)]" />
              <div className="relative space-y-3 sm:space-y-4">
                <p className="luminous-kicker">Reserve with quiet precision</p>
                <h1 className="heading-page luminous-balance max-w-2xl">{restaurantName}</h1>
                <p className="text-body-warm luminous-copy-measure">
                  Live availability, practical details, and confirmation cues all stay in one calm
                  editorial rhythm.
                </p>
              </div>
              <div className="relative justify-self-start md:justify-self-end md:pt-1">
                <div className="luminous-glass max-w-[16rem] rounded-[1.25rem] px-4 py-4 text-left md:text-right">
                  <p className="luminous-kicker text-[0.65rem]">Booking flow</p>
                  <p className="text-sm font-semibold text-foreground">One decision at a time</p>
                  <p className="text-subtle hidden text-xs leading-5 md:block">
                    Clean timing, softer surfaces, and no unnecessary detours.
                  </p>
                </div>
              </div>
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
