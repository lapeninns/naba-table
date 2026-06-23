'use client';

import { RefreshCcw } from 'lucide-react';

import { OpsPageHeader } from '@/components/features/ops-shell/patterns/OpsPageHeader';
import { OpsStatusBadge } from '@/components/features/ops-shell/patterns/OpsStatusBadge';
import { Button } from '@/components/ui/button';

export type FloorPlanHeaderProps = {
  venueName: string;
  summary: string;
  onRefresh: () => void;
};

/** Floor-plan page header built on the canonical OpsPageHeader. */
export function FloorPlanHeader({ venueName, summary, onRefresh }: FloorPlanHeaderProps) {
  return (
    <OpsPageHeader
      title={venueName}
      meta={
        <>
          {/* No literal separator between summary and badge: the badge pill is self-delimiting,
              so when it wraps to its own line on mobile nothing is left dangling on the row above
              (the summary already uses "·" for its own internal rhythm). */}
          <span>{summary}</span>
          <OpsStatusBadge label="Service operational" tone="neutral" />
        </>
      }
      secondaryActions={
        // Compact, right-aligned on mobile (not a heavy full-width row between the title and the
        // stats); relaxes to the normal header action on sm+.
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={onRefresh}
          className="ml-auto h-11 w-fit gap-2 sm:ml-0 sm:h-9"
        >
          <RefreshCcw className="size-4" /> Refresh
        </Button>
      }
    />
  );
}
