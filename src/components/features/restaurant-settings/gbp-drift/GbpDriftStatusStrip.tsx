'use client';

import { GitCompareArrows } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { useGbpDrift } from './useGbpDrift';

export function GbpDriftStatusStrip() {
  const { isLinked, totalDriftCount, openCompare, isLoading } = useGbpDrift();

  if (!isLinked) {
    return null;
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
        onClick={() => openCompare({ filter: totalDriftCount > 0 ? 'drifted_only' : 'all' })}
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
