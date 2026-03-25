'use client';

import { GuestPageShell, HeadingXL, TextBody } from '@/components/guest/ui';
import { cn } from '@/lib/utils';

import type { ReactNode } from 'react';

type GuestPortalPageProps = {
  eyebrow: string;
  title: ReactNode;
  description: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  heroClassName?: string;
  contentClassName?: string;
};

export function GuestPortalPage({
  eyebrow,
  title,
  description,
  actions,
  children,
  heroClassName,
  contentClassName,
}: GuestPortalPageProps) {
  return (
    <GuestPageShell
      hero={
        <div
          className={cn(
            'mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-10 sm:gap-6 sm:px-6 sm:py-14 lg:py-18',
            heroClassName,
          )}
        >
          <div className="space-y-2 sm:space-y-3 animate-fade-in-up">
            <p className="text-xs uppercase tracking-[0.2em] text-subtle">{eyebrow}</p>
            <HeadingXL>{title}</HeadingXL>
            <TextBody className="max-w-2xl">{description}</TextBody>
          </div>
          {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
        </div>
      }
      contentClassName={cn('mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:py-10', contentClassName)}
    >
      {children}
    </GuestPageShell>
  );
}
