import React from 'react';

import { cn } from '@shared/lib/cn';

export interface PageHeroProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
  size?: 'default' | 'large';
  gradient?: boolean;
}

export function PageHero({
  title,
  description,
  children,
  className,
  size = 'default',
  gradient = true,
}: PageHeroProps) {
  return (
    <section
      className={cn(
        'relative overflow-hidden px-4 py-14 sm:px-6 sm:py-18 lg:px-8',
        size === 'large' && 'lg:py-24',
        gradient && 'pg-dark-hero',
        className,
      )}
    >
      {gradient ? (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="pg-dark-hero-orb-primary absolute left-[-5%] top-[-20%] size-64 rounded-full blur-3xl"
            aria-hidden
          />
          <div
            className="pg-dark-hero-orb-accent absolute right-[5%] top-[10%] size-80 rounded-full blur-3xl"
            aria-hidden
          />
        </div>
      ) : null}

      <div className="relative mx-auto w-full max-w-6xl">
        <div
          className={cn(
            'mx-auto max-w-4xl rounded-3xl p-8 text-center backdrop-blur',
            gradient ? 'pg-dark-hero-panel' : 'border border-border bg-card text-card-foreground',
          )}
        >
          <div
            className={cn(
              'inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]',
              gradient ? 'pg-dark-hero-kicker' : 'bg-muted text-muted-foreground',
            )}
          >
            Guest Experience
          </div>
          <h1
            className={cn(
              'mt-4 animate-fade-in font-bold leading-tight tracking-tight',
              size === 'large'
                ? 'text-4xl sm:text-5xl lg:text-6xl'
                : 'text-3xl sm:text-4xl lg:text-5xl',
            )}
          >
            {title}
          </h1>
          {description ? (
            <p
              className={cn(
                'mt-4 animate-fade-in leading-relaxed sm:mt-6',
                gradient ? 'pg-dark-hero-muted' : 'text-muted-foreground',
                size === 'large' ? 'text-lg sm:text-xl' : 'text-base sm:text-lg',
              )}
              style={{ animationDelay: '120ms' }}
            >
              {description}
            </p>
          ) : null}
          {children ? (
            <div
              className="mt-8 flex animate-fade-in flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-6"
              style={{ animationDelay: '200ms' }}
            >
              {children}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
