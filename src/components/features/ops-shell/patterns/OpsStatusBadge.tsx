'use client';

import { Badge } from '@/components/ui/badge';
import { OPS_STATUS_TONE_CLASSES } from '@/lib/ops/status-tones';
import { cn } from '@/lib/utils';

import type { OpsStatusTone } from '@/lib/ops/status-tones';
import type { ReactNode } from 'react';

export type OpsStatusBadgeProps = {
  label: ReactNode;
  /** Semantic tone. 'default' is an alias for 'neutral'. */
  tone?: OpsStatusTone | 'default';
  className?: string;
};

const resolveTone = (tone: OpsStatusBadgeProps['tone']): OpsStatusTone =>
  tone === 'default' ? 'neutral' : (tone as OpsStatusTone);

export function OpsStatusBadge({ label, tone = 'default', className }: OpsStatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn('rounded-md border text-xs font-medium', OPS_STATUS_TONE_CLASSES[resolveTone(tone)], className)}
    >
      {label}
    </Badge>
  );
}
