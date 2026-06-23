'use client';

import { AlertCircle, LayoutGrid, RefreshCcw } from 'lucide-react';

import { OPS_PAGE_RHYTHM_CLASS } from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { OpsPageShell } from '@/components/features/ops-shell/patterns/OpsPageShell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { BookingStateMachineProvider } from '@/contexts/booking-state-machine';

import { FloorPlanLoadingSkeleton } from './FloorPlanLoadingSkeleton';
import { FloorPlanShell } from './FloorPlanShell';
import { formatClock } from './format';
import { useFloorPlanState } from './useFloorPlanState';

export type FloorPlanClientProps = {
  initialNowIso: string;
};

export function FloorPlanClient({ initialNowIso }: FloorPlanClientProps) {
  return (
    <BookingStateMachineProvider>
      <FloorPlanClientContent initialNowIso={initialNowIso} />
    </BookingStateMachineProvider>
  );
}

function FloorPlanClientContent({ initialNowIso }: FloorPlanClientProps) {
  const fp = useFloorPlanState({ initialNowIso });
  const clock = formatClock(fp.effectiveMs, fp.timezone);

  if (fp.isError) {
    return (
      <OpsPageShell variant="standard" className={OPS_PAGE_RHYTHM_CLASS}>
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Unable to load the floor plan</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3">
            <span>Something went wrong loading your tables. Please try again.</span>
            <Button variant="outline" size="sm" onClick={fp.refetch} className="gap-2">
              <RefreshCcw className="size-4" /> Retry
            </Button>
          </AlertDescription>
        </Alert>
      </OpsPageShell>
    );
  }

  if (fp.isLoading) {
    return (
      <OpsPageShell variant="standard" className={OPS_PAGE_RHYTHM_CLASS}>
        <FloorPlanLoadingSkeleton />
      </OpsPageShell>
    );
  }

  if (fp.isEmpty) {
    return (
      <OpsPageShell variant="standard" className={OPS_PAGE_RHYTHM_CLASS}>
        <OpsEmptyState
          icon={<LayoutGrid className="size-6" />}
          title="No tables yet"
          description="Add tables in Settings → Restaurant → Tables and they will appear here, ready to arrange and seat."
        />
      </OpsPageShell>
    );
  }

  return (
    <OpsPageShell variant="standard" className={OPS_PAGE_RHYTHM_CLASS}>
      <FloorPlanShell fp={fp} clock={clock} />
    </OpsPageShell>
  );
}
