import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { opsHref } from '@/lib/url/opsHref';
import { cn } from '@/lib/utils';

import type { ReadinessSummary } from './buildSetupCards';

type SetupProgressPanelProps = {
  readiness: ReadinessSummary;
};

/** Readiness summary: whether guests can book, the next required step and a segmented bar. */
export function SetupProgressPanel({ readiness }: SetupProgressPanelProps) {
  return (
    <Card
      role="region"
      aria-labelledby="setup-readiness-heading"
      data-testid="setup-readiness-summary"
      className="flex flex-col gap-3 p-4 sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2
            id="setup-readiness-heading"
            className="flex items-center gap-2 text-base font-semibold leading-6 text-foreground"
          >
            {readiness.ready ? (
              <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
            ) : null}
            {readiness.hasFailedCheck ? (
              <AlertTriangle className="size-4 shrink-0 text-destructive" aria-hidden />
            ) : null}
            {readiness.title}
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">{readiness.description}</p>
        </div>
        {readiness.ready ? (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="w-fit shrink-0 [@media(pointer:coarse)]:min-h-11"
          >
            <Link href={opsHref('/settings/restaurant/availability')}>Preview guest times</Link>
          </Button>
        ) : null}
      </div>

      <div role="img" aria-label={readiness.progressLabel} className="flex gap-1">
        {readiness.segments.map((done, index) => (
          <span
            key={index}
            data-state={done ? 'complete' : 'incomplete'}
            className={cn('h-1.5 flex-1 rounded-full', done ? 'bg-success' : 'bg-muted')}
          />
        ))}
      </div>
    </Card>
  );
}
