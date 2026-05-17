'use client';

import { CheckCircle2, GitCompareArrows } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { useOptionalGbpDrift } from './useGbpDrift';

export type GbpDriftFieldBadgeProps = {
  readonly fieldKey: string;
  readonly className?: string;
};

export function GbpDriftFieldBadge({ fieldKey, className }: GbpDriftFieldBadgeProps) {
  const drift = useOptionalGbpDrift();
  const view = drift?.fieldViewByKey.get(fieldKey);

  if (!drift?.isLinked || !view) {
    return null;
  }

  const isDrifted = view.effectiveStatus === 'drifted';

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn('h-6 px-0 hover:bg-transparent', className)}
      onClick={() => drift.openCompare({ fieldKey, sectionKey: view.sectionKey })}
      aria-label={`Compare ${view.label} with Google`}
    >
      <Badge
        variant={isDrifted ? 'default' : 'secondary'}
        className={cn(
          'h-5 gap-1 rounded-full px-2 text-[10px] font-semibold uppercase',
          isDrifted && 'motion-safe:animate-pulse',
        )}
      >
        {isDrifted ? (
          <GitCompareArrows data-icon="inline-start" aria-hidden />
        ) : (
          <CheckCircle2 data-icon="inline-start" aria-hidden />
        )}
        {isDrifted ? 'Drifted from GBP' : 'Synced with GBP'}
      </Badge>
    </Button>
  );
}
