'use client';

import { ExternalLink } from 'lucide-react';

import { CopyButton } from '@/components/ui/copy-button';
import { cn } from '@/lib/utils';

import type { DetailCardProps } from '../types';

/**
 * Reusable detail card component for displaying labeled information
 * Single Responsibility: Display a single piece of detail information
 */
export function DetailCard({
  icon: Icon,
  label,
  value,
  href,
  actionLabel,
  copyable,
  relativeTime,
  compact,
}: DetailCardProps) {
  const showCopyButton = copyable && value && value !== 'Not provided';
  const isExternal = href?.startsWith('http');

  const content = (
    <div className={cn('flex items-start gap-3', compact ? 'p-3' : 'p-4')}>
      <div className={cn('rounded-lg bg-primary/10', compact ? 'p-2' : 'p-2.5')}>
        <Icon
          className={cn('text-primary', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')}
          aria-hidden
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span
          className={cn(
            'truncate font-semibold text-foreground',
            compact ? 'text-sm' : 'text-base'
          )}
        >
          {value}
        </span>
        {relativeTime ? (
          <span className="mt-0.5 text-xs text-muted-foreground">{relativeTime}</span>
        ) : null}
        {href && actionLabel ? (
          <span className="mt-1 flex items-center gap-1 text-xs font-medium text-primary group-hover:underline">
            {actionLabel}
            {isExternal ? <ExternalLink className="h-3 w-3" /> : null}
          </span>
        ) : null}
      </div>
      {showCopyButton ? (
        <CopyButton
          text={value}
          label={label}
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0"
        />
      ) : null}
    </div>
  );

  if (href) {
    return (
      <a
        href={href}
        target={isExternal ? '_blank' : undefined}
        rel={isExternal ? 'noopener noreferrer' : undefined}
        className={cn(
          'group block rounded-xl border bg-card shadow-sm transition-all hover:border-primary/50 hover:shadow-md',
          compact ? 'bg-background' : ''
        )}
      >
        {content}
      </a>
    );
  }

  return (
    <div className={cn('rounded-xl border bg-card shadow-sm', compact ? 'bg-background' : '')}>
      {content}
    </div>
  );
}
