import { SkeletonText } from 'nabatable-platform';

export const GuestNameLoading = () => (
  <div className="flex flex-col gap-3 w-72 rounded-lg border p-4">
    <SkeletonText className="h-4 w-40 rounded-md bg-slate-300" />
    <SkeletonText className="h-4 w-28 rounded-md bg-slate-300" />
    <SkeletonText className="h-4 w-52 rounded-md bg-slate-300" />
  </div>
);

export const BookingLineLoading = () => (
  <div className="flex items-center gap-3 w-80 rounded-lg border p-4">
    <SkeletonText className="h-9 w-9 rounded-full bg-slate-300" />
    <div className="flex flex-col gap-2">
      <SkeletonText className="h-4 w-32 rounded-md bg-slate-300" />
      <SkeletonText className="h-3 w-24 rounded-md bg-slate-300" />
    </div>
    <SkeletonText className="ml-auto h-4 w-16 rounded-md bg-slate-300" />
  </div>
);

export const DefaultWidth = () => (
  <div className="flex flex-col gap-3 w-72 rounded-lg border p-4">
    <span className="text-xs text-muted-foreground">Loading covers…</span>
    <SkeletonText className="h-4 w-full rounded-md bg-slate-300" />
    <SkeletonText className="h-4 w-48 rounded-md bg-slate-300" />
  </div>
);
