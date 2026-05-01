'use client';

import { Check, Info, ShieldAlert, ShieldQuestion } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import type { CoreVerificationStatus } from './google-business-profile/googleBusinessProfileVerification';

type GoogleBusinessProfileComparisonBadgeProps = {
  status: Exclude<CoreVerificationStatus, 'unavailable'>;
  tooltipTitle?: string;
  tooltipLines?: string[];
  tooltipFooter?: string | null;
  ariaLabel?: string;
  className?: string;
  verifiedLabel?: string;
  driftedLabel?: string;
  partialLabel?: string;
};

function statusPresentation(props: {
  status: GoogleBusinessProfileComparisonBadgeProps['status'];
  verifiedLabel: string;
  driftedLabel: string;
  partialLabel: string;
}) {
  switch (props.status) {
    case 'verified':
      return {
        label: props.verifiedLabel,
        icon: Check,
        className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      };
    case 'drifted':
      return {
        label: props.driftedLabel,
        icon: ShieldAlert,
        className: 'border-amber-200 bg-amber-50 text-amber-700',
      };
    case 'partial':
    default:
      return {
        label: props.partialLabel,
        icon: ShieldQuestion,
        className: 'border-sky-200 bg-sky-50 text-sky-700',
      };
  }
}

export function GoogleBusinessProfileComparisonBadge({
  status,
  tooltipTitle,
  tooltipLines = [],
  tooltipFooter = null,
  ariaLabel = 'Google Business Profile comparison details',
  className,
  verifiedLabel = 'Matches GBP',
  driftedLabel = 'Drifted from GBP',
  partialLabel = 'GBP Partial',
}: GoogleBusinessProfileComparisonBadgeProps) {
  const presentation = statusPresentation({
    status,
    verifiedLabel,
    driftedLabel,
    partialLabel,
  });
  const Icon = presentation.icon;
  const hasTooltip = Boolean(tooltipTitle || tooltipLines.length > 0 || tooltipFooter);

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <Badge
        variant="outline"
        className={cn(
          'h-5 gap-1 rounded-full px-2 text-[10px] font-semibold uppercase tracking-wide',
          presentation.className,
        )}
      >
        <Icon className="size-3" aria-hidden />
        <span>{presentation.label}</span>
      </Badge>
      {hasTooltip ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              aria-label={ariaLabel}
            >
              <Info className="size-3.5" aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" align="start" className="max-w-sm space-y-2 px-3 py-2">
            {tooltipTitle ? <p className="text-xs font-semibold">{tooltipTitle}</p> : null}
            {tooltipLines.length > 0 ? (
              <div className="space-y-1">
                {tooltipLines.map((line) => (
                  <p key={line} className="text-xs leading-snug">
                    {line}
                  </p>
                ))}
              </div>
            ) : null}
            {tooltipFooter ? (
              <p className="border-t border-background/20 pt-2 text-xs leading-snug text-background/80">
                {tooltipFooter}
              </p>
            ) : null}
          </TooltipContent>
        </Tooltip>
      ) : null}
    </span>
  );
}
