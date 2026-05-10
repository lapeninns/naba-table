import React from 'react';

import { cn } from '@shared/lib/cn';

export interface PageSectionProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  id?: string;
}

export function PageSection({ title, description, children, className, id }: PageSectionProps) {
  return (
    <section id={id} className={cn('px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20', className)}>
      <div className="mx-auto w-full max-w-6xl">
        {title || description ? (
          <div className="mb-10 flex flex-col gap-3 sm:mb-12 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-2">
              {title ? (
                <h2 className="text-2xl font-semibold tracking-tight text-primary-foreground sm:text-3xl">
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p className="max-w-2xl text-base leading-relaxed text-primary-foreground/80 sm:text-lg">
                  {description}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
        <div className="pg-dark-section-panel rounded-3xl p-6 backdrop-blur sm:p-8">{children}</div>
      </div>
    </section>
  );
}
