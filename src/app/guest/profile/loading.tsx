import { Skeleton } from '@/components/ui/skeleton';

export default function ProfileLoading() {
  return (
    <div className="min-h-screen px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <Skeleton className="h-8 w-40" />
        <div className="space-y-4 rounded-2xl border border-slate-100 p-6 shadow-sm">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-48" />
        </div>
      </div>
    </div>
  );
}
