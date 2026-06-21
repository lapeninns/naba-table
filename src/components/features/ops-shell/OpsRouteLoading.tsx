import { OPS_PAGE_RHYTHM_CLASS } from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { OpsPageShell } from '@/components/features/ops-shell/patterns/OpsPageShell';
import { Skeleton } from '@/components/ui/skeleton';

export function OpsRouteLoading() {
  return (
    <div className="min-h-screen bg-background" aria-busy="true">
      <OpsPageShell variant="standard" className={OPS_PAGE_RHYTHM_CLASS}>
        <div className="space-y-3">
          <Skeleton className="h-8 w-48 sm:h-9 sm:w-56" />
          <Skeleton className="h-4 w-72 sm:w-96" />
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-4">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>

          <div className="space-y-4">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
        </div>
      </OpsPageShell>
    </div>
  );
}
