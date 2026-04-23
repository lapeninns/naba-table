import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div className="min-h-[100dvh] py-10">
      <div className="pg-container space-y-8">
        <div className="space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
