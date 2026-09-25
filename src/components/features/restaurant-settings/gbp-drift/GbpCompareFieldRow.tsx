'use client';

import { ArrowRight, CheckCircle2, ExternalLink, GitCompareArrows } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/typography';
import { cn } from '@/lib/utils';

import { formatGbpDriftPreview } from './fieldDisplay';
import { GBP_DRIFT_SECTION_ROUTES } from './sectionRoutes';
import { useGbpDrift } from './useGbpDrift';

import type { GbpDriftFieldView } from './types';

export type GbpCompareFieldRowProps = {
  readonly view: GbpDriftFieldView;
};

export function GbpCompareFieldRow({ view }: GbpCompareFieldRowProps) {
  const { applyFieldFromGoogle, isApplying } = useGbpDrift();
  const isDrifted = view.effectiveStatus === 'drifted';

  return (
    <div
      data-gbp-field-key={view.fieldKey}
      className={cn(
        'rounded-md border border-border/70 bg-card p-3',
        isDrifted ? 'ring-1 ring-primary/20' : 'bg-muted/20',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{view.label}</p>
            <Badge variant={isDrifted ? 'default' : 'secondary'} className="gap-1 text-xs">
              {isDrifted ? (
                <GitCompareArrows data-icon="inline-start" aria-hidden />
              ) : (
                <CheckCircle2 data-icon="inline-start" aria-hidden />
              )}
              {isDrifted ? 'Differs from Google' : 'Matches Google'}
            </Badge>
          </div>
          {view.helpText ? (
            <Text variant="caption" className="mt-1">
              {view.helpText}
            </Text>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button asChild type="button" variant="outline" size="sm">
            <Link href={GBP_DRIFT_SECTION_ROUTES[view.sectionKey]}>
              Edit locally
              <ExternalLink data-icon="inline-end" aria-hidden />
            </Link>
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!view.canImport || !isDrifted || isApplying}
            onClick={() => void applyFieldFromGoogle(view.fieldKey)}
          >
            Use Google Info
            {isDrifted ? (
              <ArrowRight data-icon="inline-end" aria-hidden />
            ) : (
              <CheckCircle2 data-icon="inline-end" aria-hidden />
            )}
          </Button>
        </div>
      </div>

      <Separator className="my-3" />

      <div className="grid gap-3 md:grid-cols-2">
        <div className="min-w-0">
          <p className="text-xs font-medium leading-4 text-muted-foreground">Nabatable</p>
          <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/50 p-2 font-mono text-xs leading-5 text-foreground">
            {formatGbpDriftPreview(view.localValue)}
          </pre>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium leading-4 text-muted-foreground">Google</p>
          <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/50 p-2 font-mono text-xs leading-5 text-foreground">
            {formatGbpDriftPreview(view.gbpValue)}
          </pre>
        </div>
      </div>

      {!view.canImport && isDrifted && view.field.capability.blockedReasons.length > 0 ? (
        <Text variant="caption" className="mt-2">
          {view.field.capability.blockedReasons.join(' ')}
        </Text>
      ) : null}
    </div>
  );
}
