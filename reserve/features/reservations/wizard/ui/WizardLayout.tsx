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
  banner,
  children,
  footer,
  elementType = 'main',
  className,
  contentClassName,
}: WizardLayoutProps) {
  const mainStyle = stickyVisible
    ? {
        paddingBottom: `calc(${stickyHeight}px + env(safe-area-inset-bottom, 0px) + 1.5rem)`,
      }
    : undefined;

  const Container = elementType === 'div' ? 'div' : 'main';

  return (
    <>
      <Container
        style={mainStyle}
        className={cn(
          'min-h-screen w-full bg-muted/[0.15] px-4 pb-24 pt-6 font-sans text-foreground transition-[padding-bottom] duration-200 sm:pt-12 md:px-6 lg:px-10',
          className,
        )}
      >
        <div
          className={cn(
            'mx-auto flex w-full max-w-5xl flex-col gap-10 sm:gap-12',
            contentClassName,
          )}
        >
          <span ref={heroRef} aria-hidden className="block h-px w-full" />
          {banner ? <div>{banner}</div> : null}
          {children}
        </div>
      </Container>
      {footer}
    </>
  );
}
