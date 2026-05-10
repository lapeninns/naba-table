import { GuestContent, GuestPageFrame, GuestPanel } from '@/components/guest/ui';
import { Skeleton } from '@/components/ui/skeleton';

export default function GuestShellLoading() {
  return (
    <GuestPageFrame>
      <GuestContent className="py-10">
        <GuestPanel className="space-y-3 p-6">
          <Skeleton className="h-5 w-40 rounded-full" />
          <Skeleton className="h-12 w-full max-w-xl rounded-xl" />
          <Skeleton className="h-5 w-full max-w-2xl rounded-lg" />
        </GuestPanel>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48 rounded-[var(--pg-radius-md)]" />
          <Skeleton className="h-48 rounded-[var(--pg-radius-md)]" />
          <Skeleton className="h-48 rounded-[var(--pg-radius-md)]" />
          <Skeleton className="h-48 rounded-[var(--pg-radius-md)]" />
        </div>
      </GuestContent>
    </GuestPageFrame>
  );
}
