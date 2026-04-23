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
  const Container = elementType === 'div' ? 'div' : 'main';
  const footerOffset = stickyVisible ? stickyHeight : 0;

  return (
    <>
      <Container
        style={{
          paddingBottom: `calc(1.5rem + ${footerOffset}px + env(safe-area-inset-bottom, 0px))`,
          scrollPaddingBottom: `calc(${footerOffset}px + env(safe-area-inset-bottom, 0px))`,
        }}
        className={cn(
          'w-full',
          'pg-surface',
          'px-4 pt-4 sm:pt-5 md:px-6 lg:px-8',
          'font-sans text-foreground',
          className,
        )}
      >
        <div
          style={{
            scrollPaddingBottom: `calc(${footerOffset}px + env(safe-area-inset-bottom, 0px))`,
          }}
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
              <p className="pg-kicker">Book at</p>
              <h1 className="pg-card-title">{restaurantName}</h1>
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
