'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { buildOpsBookingsTableFilterChips } from '../opsBookingsQueryDomain';

import type { useOpsBookingsState } from '../useOpsBookingsState';

type OpsBookingsQueryState = ReturnType<typeof useOpsBookingsState>['queryState'];

export function OpsBookingsTableFilterBanner({
  queryState,
}: {
  queryState: OpsBookingsQueryState;
}) {
  if (!queryState.resolvedTableId) return null;

  const chips = buildOpsBookingsTableFilterChips({
    resolvedTableLabel: queryState.resolvedTableLabel,
    resolvedTime: queryState.resolvedTime,
    resolvedWindowMinutes: queryState.resolvedWindowMinutes,
    resolvedWindowMode: queryState.resolvedWindowMode,
  });

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      {chips.map((chip) => (
        <Badge
          key={chip.key}
          variant={chip.variant}
          className="rounded-md text-xs font-medium text-foreground"
        >
          {chip.label}
        </Badge>
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={queryState.handleClearTableFilter}
      >
        Clear filter
      </Button>
    </div>
  );
}
