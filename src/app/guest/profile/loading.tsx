import { Skeleton } from '@/components/ui/skeleton';

export default function ProfileLoading() {
  return (
    <div className="min-h-[100dvh] py-10">
      <div className="pg-container-sm space-y-6">
        <Skeleton className="h-8 w-40" />
        <div className="pg-card space-y-4 p-6">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-48" />
        </div>
      </div>
    </div>
  );
}
