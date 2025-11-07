'use client';

import * as React from 'react';

import { cn } from '@shared/lib/cn';

import type { WizardSummary } from './WizardProgress';

export interface StepSummaryProps {
  summary: WizardSummary;
  className?: string;
  layout?: 'stacked' | 'inline';
}

export function StepSummary({ summary, className, layout = 'stacked' }: StepSummaryProps) {
  const details = summary.details ?? [];
  const primary = summary.primary?.trim() || 'Select your date';
  const detailText = details.filter(Boolean).join(' • ');

  return (
    <div
      className={cn(
        'min-w-0 text-foreground',
        layout === 'inline'
          ? 'flex flex-col gap-0.5 sm:items-end sm:text-right'
          : 'flex flex-col gap-0.5',
        className,
      )}
      aria-live="polite"
    >
      <p className="truncate text-base font-semibold sm:text-lg" title={primary}>
        {primary}
      </p>
      {detailText ? (
        <p
          className="text-sm text-muted-foreground sm:text-base"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {detailText}
        </p>
      ) : null}
    </div>
  );
}
