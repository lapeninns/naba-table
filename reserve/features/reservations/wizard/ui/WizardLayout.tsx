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
  progress?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  elementType?: 'main' | 'div';
  surface?: WizardLayoutSurface;
  className?: string;
  contentClassName?: string;
  onFocusCapture?: React.FocusEventHandler<HTMLElement>;
}

export function WizardLayout({
  heroRef,
  stickyHeight = 0,
  stickyVisible = false,
  restaurantName,
  banner,
  progress,
  children,
  footer,
  elementType = 'main',
  surface = 'guest',
  className,
  contentClassName,
  onFocusCapture,
}: WizardLayoutProps) {
  const Container = elementType === 'div' ? 'div' : 'main';
  const footerOffset = stickyVisible ? stickyHeight : 0;
  const isOpsSurface = surface === 'ops';
  const handleFocusCapture: React.FocusEventHandler<HTMLElement> = (event) => {
    onFocusCapture?.(event);

    if (!stickyVisible || stickyHeight <= 0 || !(event.target instanceof HTMLElement)) {
      return;
    }

    const focusedBounds = event.target.getBoundingClientRect();
    const visibleBottom = window.innerHeight - stickyHeight;
    const isFocusClear = focusedBounds.top >= 0 && focusedBounds.bottom <= visibleBottom;

    if (!isFocusClear) {
      event.target.scrollIntoView({ block: 'center', inline: 'nearest' });
    }
  };

  return (
    <>
      <Container
        style={{
          paddingBottom: `calc(1.5rem + ${footerOffset}px + env(safe-area-inset-bottom, 0px))`,
          scrollPaddingBottom: `calc(${footerOffset}px + env(safe-area-inset-bottom, 0px))`,
        }}
        onFocusCapture={handleFocusCapture}
        className={cn(
          'w-full',
          isOpsSurface ? 'py-0' : 'pg-page py-[var(--pg-section-y-tight)]',
          'font-sans text-foreground',
          className,
        )}
      >
        <div
          style={{
            scrollPaddingBottom: `calc(${footerOffset}px + env(safe-area-inset-bottom, 0px))`,
          }}
          className={cn(
            'flex w-full flex-col gap-4 sm:gap-5',
            isOpsSurface ? 'p-3 sm:p-4 lg:p-5' : 'mx-auto max-w-3xl px-[var(--pg-gutter)]',
            contentClassName,
          )}
        >
          <span ref={heroRef} aria-hidden className="block h-px w-full" />

          {restaurantName && (
            <header className="space-y-1 border-b border-border/70 pb-4 sm:pb-5">
              <p className="pg-kicker">Book at</p>
              <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {restaurantName}
              </h1>
            </header>
          )}

          {banner ? <div>{banner}</div> : null}
          {progress ? <div data-booking-wizard-progress-slot="">{progress}</div> : null}
          {children}
        </div>
      </Container>
      {footer}
    </>
  );
}
