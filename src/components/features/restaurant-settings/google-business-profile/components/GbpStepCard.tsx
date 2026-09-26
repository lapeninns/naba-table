import { Check } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import type { ReactNode } from 'react';

type GbpStepCardProps = {
  readonly step: 1 | 2 | 3;
  readonly title: string;
  readonly description: ReactNode;
  /** A finished step shows a filled marker; the step number stays in the accessible name. */
  readonly done?: boolean;
  readonly status?: ReactNode;
  readonly actions?: ReactNode;
  readonly children?: ReactNode;
  readonly footer?: ReactNode;
  readonly id?: string;
  readonly className?: string;
  readonly contentClassName?: string;
  readonly testId?: string;
};

/**
 * One numbered step of the Google Business Profile page: connection, business location and
 * review. The heading carries the step number as text so it is announced ("Step 1: Connection").
 */
export function GbpStepCard({
  step,
  title,
  description,
  done = false,
  status,
  actions,
  children,
  footer,
  id,
  className,
  contentClassName,
  testId,
}: GbpStepCardProps) {
  const headingId = id ? `${id}-heading` : undefined;

  return (
    <Card
      id={id}
      data-testid={testId}
      aria-labelledby={headingId}
      role={headingId ? 'region' : undefined}
      variant="compact"
      className={cn('min-w-0 scroll-mt-24 border-border/70 shadow-none', className)}
    >
      <CardHeader className="gap-3 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span
              aria-hidden
              className={cn(
                'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums',
                done
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-foreground',
              )}
            >
              {done ? <Check className="size-3.5" /> : step}
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <h2 id={headingId} className="text-base font-semibold leading-6 text-foreground">
                <span className="sr-only">{`Step ${step}${done ? ', done' : ''}:`}</span> {title}
              </h2>
              <CardDescription className="max-w-[65ch] text-sm leading-6">
                {description}
              </CardDescription>
            </div>
          </div>
          {status ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{status}</div>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </CardHeader>
      {children ? (
        <CardContent
          className={cn(
            'flex min-w-0 flex-col gap-3 border-t border-border/60 px-4 py-4 sm:px-5',
            contentClassName,
          )}
        >
          {children}
        </CardContent>
      ) : null}
      {footer ? (
        <div className="flex min-w-0 flex-col gap-3 border-t border-border/60 px-4 py-3 sm:px-5">
          {footer}
        </div>
      ) : null}
    </Card>
  );
}
