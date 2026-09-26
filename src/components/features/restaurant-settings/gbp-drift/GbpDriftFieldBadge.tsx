'use client';

import { CheckCircle2, GitCompareArrows } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import { formatGbpDriftPreview } from './fieldDisplay';
import { useOptionalGbpDrift } from './useGbpDrift';
import { openSettingsCompare } from '../gbp/openSettingsCompare';

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
  const statusLabel = isDrifted ? 'Differs from Google' : 'Matches Google';

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn('h-6 px-0 hover:bg-transparent', className)}
            onClick={() =>
              openSettingsCompare(drift.openCompare, {
                preset: 'field',
                fieldKey,
                sectionKey: view.sectionKey,
              })
            }
            aria-label={`${statusLabel}: compare ${view.label} with Google`}
          >
            <Badge
              variant={isDrifted ? 'default' : 'secondary'}
              className={cn(
                'h-5 gap-1 rounded-full px-2 text-xs font-medium',
                isDrifted && 'motion-safe:animate-pulse',
              )}
            >
              {isDrifted ? (
                <GitCompareArrows data-icon="inline-start" aria-hidden />
              ) : (
                <CheckCircle2 data-icon="inline-start" aria-hidden />
              )}
              {statusLabel}
            </Badge>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" align="start" className="max-w-sm break-words">
          Google has: {formatGbpDriftPreview(view.gbpValue)}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
