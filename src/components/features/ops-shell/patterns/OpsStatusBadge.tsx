'use client';

import { Badge } from '@/components/ui/badge';
import { OPS_STATUS_TONE_CLASSES } from '@/lib/ops/status-tones';
import { cn } from '@/lib/utils';

import type { OpsStatusTone } from '@/lib/ops/status-tones';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export type OpsStatusBadgeProps = {
  label: ReactNode;
  /** Semantic tone. 'default' is an alias for 'neutral'. */
  tone?: OpsStatusTone | 'default';
  /** Optional leading status icon; inherits the tone's text color. */
  icon?: LucideIcon;
  className?: string;
};

const resolveTone = (tone: OpsStatusBadgeProps['tone']): OpsStatusTone =>
  tone === 'default' ? 'neutral' : (tone as OpsStatusTone);

export function OpsStatusBadge({
  label,
  tone = 'default',
  icon: Icon,
  className,
}: OpsStatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'inline-flex items-center gap-1 rounded-full border text-xs font-medium',
        OPS_STATUS_TONE_CLASSES[resolveTone(tone)],
        className,
      )}
    >
      {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
      {label}
    </Badge>
  );
}
