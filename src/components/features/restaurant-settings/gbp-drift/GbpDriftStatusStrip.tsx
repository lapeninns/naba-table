'use client';

import { GitCompareArrows } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { useGbpDrift } from './useGbpDrift';
import { openSettingsCompare } from '../gbp/openSettingsCompare';

type GbpDriftStatusStripProps = {
  compact?: boolean;
};

export function GbpDriftStatusStrip({ compact = false }: GbpDriftStatusStripProps) {
  const { isLinked, totalDriftCount, openCompare, isLoading } = useGbpDrift();

  if (!isLinked) {
    return null;
  }

  if (compact) {
    return (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 sm:px-4">
        <p className="min-w-0 text-xs leading-5 text-muted-foreground">
          {isLoading
            ? 'Checking Google comparison…'
            : totalDriftCount > 0
              ? `${totalDriftCount} field${totalDriftCount === 1 ? '' : 's'} differ from Google.`
              : 'In sync with Google for comparable fields.'}
        </p>
        <Button
          type="button"
          variant={totalDriftCount > 0 ? 'default' : 'outline'}
          size="sm"
          className="h-8 shrink-0"
          onClick={() =>
            openSettingsCompare(openCompare, {
              preset: 'globalDrifted',
              filter: totalDriftCount > 0 ? 'drifted_only' : 'all',
            })
          }
        >
          <GitCompareArrows data-icon="inline-start" className="size-3.5" aria-hidden />
          Compare
          {totalDriftCount > 0 ? (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
              {totalDriftCount}
            </Badge>
          ) : null}
        </Button>
      </div>
    );
  }

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/70 bg-muted/30 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">Google comparison</p>
        <p className="text-xs leading-5 text-muted-foreground">
          {isLoading
            ? 'Loading Google comparison state.'
            : totalDriftCount > 0
              ? `${totalDriftCount} field${totalDriftCount === 1 ? '' : 's'} need review.`
              : 'Nabatable and Google are in sync for comparable fields.'}
        </p>
      </div>
      <Button
        type="button"
        variant={totalDriftCount > 0 ? 'default' : 'outline'}
        size="sm"
        onClick={() =>
          openSettingsCompare(openCompare, {
            preset: 'globalDrifted',
            filter: totalDriftCount > 0 ? 'drifted_only' : 'all',
          })
        }
      >
        <GitCompareArrows data-icon="inline-start" aria-hidden />
        Compare with Google
        {totalDriftCount > 0 ? (
          <Badge variant="secondary" className="ml-1">
            {totalDriftCount}
          </Badge>
        ) : null}
      </Button>
    </div>
  );
}
