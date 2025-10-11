'use client';

import * as React from 'react';

import { cn } from '@shared/lib/cn';

type HeroRef =
  | React.RefObject<HTMLSpanElement | null>
  | React.MutableRefObject<HTMLSpanElement | null>;

interface WizardLayoutProps {
  heroRef?: HeroRef;
  stickyHeight?: number;
  stickyVisible?: boolean;
  banner?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  elementType?: 'main' | 'div';
}

export function WizardLayout({
  heroRef,
  stickyHeight = 0,
  stickyVisible = false,
  banner,
  children,
  footer,
  elementType = 'main',
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
          'min-h-screen w-full bg-muted/[0.15] px-4 pb-24 pt-10 font-sans text-foreground transition-[padding-bottom] duration-200 sm:pt-16 md:px-6 lg:px-10',
        )}
      >
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 sm:gap-12">
          <span ref={heroRef} aria-hidden className="block h-px w-full" />
          {banner ? <div>{banner}</div> : null}
          {children}
        </div>
      </Container>
      {footer}
    </>
  );
}
