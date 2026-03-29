'use client';

import { Badge } from '@/components/ui/badge';

import { DashboardSummaryCard } from './DashboardSummaryCard';

import type {
  DashboardBookingActionHandlers,
  DashboardListControls,
} from './types';
import type { OpsTodayBookingsSummary } from '@/types/ops';

export type OpsDashboardSummarySectionProps = {
  summary: OpsTodayBookingsSummary;
  restaurantName: string;
  controls: DashboardListControls;
  bookingActions: DashboardBookingActionHandlers;
  initialNowIso: string;
  allowTableAssignments: boolean;
  restaurantSlug?: string | null;
};

export function OpsDashboardSummarySection({
  summary,
  restaurantName,
  controls,
  bookingActions,
  initialNowIso,
  allowTableAssignments,
  restaurantSlug,
}: OpsDashboardSummarySectionProps) {
  return (
    <div className="space-y-6">
      {!allowTableAssignments ? (
        <div className="flex justify-end">
          <Badge variant="secondary" className="bg-amber-50 text-amber-700">
            Past date · Assignments locked
          </Badge>
        </div>
      ) : null}

      <DashboardSummaryCard
        summary={summary}
        restaurantName={restaurantName}
        controls={controls}
        bookingActions={bookingActions}
        initialNowIso={initialNowIso}
        allowTableAssignments={allowTableAssignments}
        restaurantSlug={restaurantSlug}
      />
    </div>
  );
}
