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

// The shared accordion height animation is 200ms; one frame of headroom captures final geometry.
const FOCUS_TRANSITION_RECHECK_MS = 250;

function getFocusVisibleBottom(stickyHeight: number) {
  const fallbackBoundary = window.innerHeight - stickyHeight;
  const navigation = document.querySelector<HTMLElement>('[data-booking-wizard-navigation]');

  if (!navigation) {
    return fallbackBoundary;
  }

  const navigationTop = navigation.getBoundingClientRect().top;
  return Number.isFinite(navigationTop) && navigationTop >= 0 && navigationTop <= window.innerHeight
    ? navigationTop
    : fallbackBoundary;
}

function scrollFocusedElementClearOfRail(target: HTMLElement, stickyHeight: number) {
  const focusedBounds = target.getBoundingClientRect();
  const visibleBottom = getFocusVisibleBottom(stickyHeight);
  const isFocusClear = focusedBounds.top >= 0 && focusedBounds.bottom <= visibleBottom;

  if (!isFocusClear) {
    target.scrollIntoView({ block: 'center', inline: 'nearest' });
  }
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
  const trailingClearance = isOpsSurface
    ? 'var(--pg-grid-gap)'
    : 'calc(var(--pg-touch-target) * 3)';
  const focusRecheckFrame = React.useRef<number | null>(null);
  const focusTransitionRecheckTimer = React.useRef<number | null>(null);

  React.useEffect(
    () => () => {
      if (focusRecheckFrame.current !== null) {
        window.cancelAnimationFrame(focusRecheckFrame.current);
      }
      if (focusTransitionRecheckTimer.current !== null) {
        window.clearTimeout(focusTransitionRecheckTimer.current);
      }
    },
    [],
  );

  const handleFocusCapture: React.FocusEventHandler<HTMLElement> = (event) => {
    if (focusRecheckFrame.current !== null) {
      window.cancelAnimationFrame(focusRecheckFrame.current);
      focusRecheckFrame.current = null;
    }
    if (focusTransitionRecheckTimer.current !== null) {
      window.clearTimeout(focusTransitionRecheckTimer.current);
      focusTransitionRecheckTimer.current = null;
    }

    onFocusCapture?.(event);

    if (!stickyVisible || stickyHeight <= 0 || !(event.target instanceof HTMLElement)) {
      return;
    }

    const focusedTarget = event.target;
    scrollFocusedElementClearOfRail(focusedTarget, stickyHeight);

    focusRecheckFrame.current = window.requestAnimationFrame(() => {
      focusRecheckFrame.current = null;
      if (focusedTarget.isConnected && document.activeElement === focusedTarget) {
        scrollFocusedElementClearOfRail(focusedTarget, stickyHeight);
      }
    });

    focusTransitionRecheckTimer.current = window.setTimeout(() => {
      focusTransitionRecheckTimer.current = null;
      if (focusedTarget.isConnected && document.activeElement === focusedTarget) {
        scrollFocusedElementClearOfRail(focusedTarget, stickyHeight);
      }
    }, FOCUS_TRANSITION_RECHECK_MS);
  };

  return (
    <>
      <Container
        style={{
          paddingBottom: `calc(${trailingClearance} + ${footerOffset}px + env(safe-area-inset-bottom, 0px))`,
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
