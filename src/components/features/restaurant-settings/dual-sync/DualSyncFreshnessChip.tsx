/**
 * Phase 3o of the unified dual-sync engine.
 *
 * Tiny chip rendering an age + tone for a dual-sync timestamp. Used
 * inside the shell header (snapshot freshness) and inside the per-field
 * row (in-sync / drift / conflict freshness).
 */

import { Clock } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { freshnessAge, type DualSyncFreshness } from './freshness';

const TONE_CLASS: Record<DualSyncFreshness['tone'], string> = {
  fresh: 'border-primary/30 bg-primary/10 text-primary dark:text-primary',
  recent: 'border-primary/30 bg-primary/10 text-primary dark:text-primary',
  stale: 'border-destructive/50 bg-destructive/10 text-destructive',
  never: 'border-muted-foreground/30 bg-muted/40 text-muted-foreground',
};

const TONE_SUFFIX: Record<DualSyncFreshness['tone'], string> = {
  fresh: 'ago',
  recent: 'ago',
  stale: 'ago',
  never: '',
};

export interface DualSyncFreshnessChipProps {
  readonly timestamp: string | null | undefined;
  /** Optional prefix label, e.g. "Verified" or "In sync". */
  readonly prefix?: string;
  /** Substituted label for the never tone, e.g. "Never verified". */
  readonly neverLabel?: string;
  readonly className?: string;
  /** Pin the relative time against a fixed `now` — used in tests. */
  readonly now?: Date;
}

export function DualSyncFreshnessChip({
  timestamp,
  prefix,
  neverLabel,
  className,
  now,
}: DualSyncFreshnessChipProps) {
  const { tone, label } = freshnessAge(timestamp, now);
  const text =
    tone === 'never'
      ? (neverLabel ?? 'Never')
      : prefix
        ? `${prefix} ${label} ${TONE_SUFFIX[tone]}`.trim()
        : `${label} ${TONE_SUFFIX[tone]}`.trim();
  return (
    <Badge
      variant="outline"
      className={cn(
        'inline-flex items-center gap-1 font-mono text-[10px]',
        TONE_CLASS[tone],
        className,
      )}
      data-tone={tone}
    >
      <Clock className="size-3" />
      {text}
    </Badge>
  );
}
