import { Skeleton } from '@/components/ui/skeleton';

export default function GuestShellLoading() {
  return (
    <div className="min-h-[100dvh] py-10">
      <div className="pg-container space-y-8">
        <div className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    </div>
  );
}
