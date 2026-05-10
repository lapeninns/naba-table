'use client';

import * as React from 'react';

import { cn } from '@shared/lib/cn';

export type WizardHeroRef =
  | React.RefObject<HTMLSpanElement | null>
  | React.MutableRefObject<HTMLSpanElement | null>;

export type WizardLayoutSurface = 'guest' | 'ops';

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
  surface?: WizardLayoutSurface;
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
  surface = 'guest',
  className,
  contentClassName,
}: WizardLayoutProps) {
  const Container = elementType === 'div' ? 'div' : 'main';
  const footerOffset = stickyVisible ? stickyHeight : 0;
  const isOpsSurface = surface === 'ops';

  return (
    <>
      <Container
        style={{
          paddingBottom: `calc(1.5rem + ${footerOffset}px + env(safe-area-inset-bottom, 0px))`,
          scrollPaddingBottom: `calc(${footerOffset}px + env(safe-area-inset-bottom, 0px))`,
        }}
        className={cn(
          'w-full',
          isOpsSurface ? 'py-0' : 'pg-page px-[var(--pg-gutter)] py-[var(--pg-section-y-tight)]',
          'font-sans text-foreground',
          className,
        )}
      >
        <div
          style={{
            scrollPaddingBottom: `calc(${footerOffset}px + env(safe-area-inset-bottom, 0px))`,
          }}
          className={cn(
            'flex w-full flex-col gap-4 rounded-[calc(var(--pg-radius-xl)+0.5rem)] border border-border/70 bg-background/78 shadow-[var(--pg-shadow-sm)] backdrop-blur-sm sm:gap-5',
            isOpsSurface ? 'p-3 sm:p-4 lg:p-5' : 'mx-auto max-w-6xl p-[var(--pg-gutter)]',
            contentClassName,
          )}
        >
          <span ref={heroRef} aria-hidden className="block h-px w-full" />

          {restaurantName && (
            <header className="pg-panel border-border/80 bg-background/90 px-4 py-4 text-center shadow-[var(--pg-shadow-edge)] sm:px-5">
              <div className="mx-auto flex max-w-xl flex-col items-center gap-3">
                <div className="space-y-1">
                  <p className="pg-kicker text-[0.66rem]">Book at</p>
                  <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                    {restaurantName}
                  </h1>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  <p className="pg-chip">Live availability</p>
                  <p className="pg-chip">Instant confirmation</p>
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
